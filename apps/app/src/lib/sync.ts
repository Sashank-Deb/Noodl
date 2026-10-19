/**
 * Optional cloud mirror in Firestore: users/{uid}/notes/{noteId} and
 * users/{uid}/folders/{folderId}.
 *
 * Cost design (stays inside the free Spark quota):
 *  - one document per note (the whole node tree), so opening a note is 0 reads
 *    (it's local) and a sync of an edited note is 1 write;
 *  - pushes are debounced; only notes/folders with updatedAt > syncedAt go up;
 *  - the realtime listener only queries docs whose *server* timestamp is newer
 *    than the last pull, so a returning device reads just what changed (server
 *    time avoids missing edits from devices with skewed or offline clocks);
 *  - images are not synced (Cloud Storage requires the paid Blaze plan).
 * Deletes are tombstones (deletedAt) so they reach every device; permanent
 * deletes remove the document and other devices apply the removal.
 * Conflicts (edited on two devices while offline) keep the newer version and
 * save the other as a "conflict copy" note, for review.
 */
import type { Firestore, Unsubscribe } from "firebase/firestore";
import { create } from "zustand";
import { db, kvGet, kvSet } from "./db";
import { getFirebaseApp } from "./firebase";
import type { Folder, MindNode, Note } from "./types";
import { newId } from "./tree";

export type SyncState = "local" | "syncing" | "synced" | "offline" | "error";
interface SyncStatus {
  state: SyncState;
  lastSyncedAt: number | null;
  conflicts: number;
  failed: number;
}
export const useSyncStatus = create<SyncStatus & { set: (p: Partial<SyncStatus>) => void }>((set) => ({
  state: "local",
  lastSyncedAt: null,
  conflicts: 0,
  failed: 0,
  set: (p) => set(p),
}));

let fs: Firestore | null = null;
let uid: string | null = null;
let generation = 0;
let unsubs: Unsubscribe[] = [];
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing = false;
let pushAgain = false;

const PUSH_DEBOUNCE_MS = 3000;
const MAX_DOC_BYTES = 900_000; // Firestore limit is 1 MiB per document
const keyFor = (u: string, k: string) => `sync:${u}:${k}`;

async function firestore() {
  if (fs) return fs;
  const app = await getFirebaseApp();
  const { initializeFirestore, getFirestore } = await import("firebase/firestore");
  try {
    fs = initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    fs = getFirestore(app);
  }
  return fs;
}

// --- Encoding: Firestore can't store nested arrays (tables) ------------------
type RemoteNode = Omit<MindNode, "table"> & { tableJson?: string };

export function toRemote(n: Note): Record<string, unknown> {
  const { syncedAt: _s, ...rest } = n;
  void _s;
  const nodes: Record<string, RemoteNode> = {};
  for (const [id, node] of Object.entries(n.nodes)) {
    const { table, ...r } = node;
    nodes[id] = table ? { ...r, tableJson: JSON.stringify(table) } : r;
  }
  return { ...rest, nodes };
}

export function fromRemote(data: Record<string, unknown>): Note {
  const { serverUpdatedAt: _t, ...rest } = data;
  void _t;
  const nodes: Record<string, MindNode> = {};
  for (const [id, raw] of Object.entries((rest.nodes as Record<string, RemoteNode>) ?? {})) {
    const { tableJson, ...r } = raw;
    let table: string[][] | undefined;
    if (tableJson) {
      try {
        const t = JSON.parse(tableJson);
        if (Array.isArray(t)) table = t.map((row: unknown) => (Array.isArray(row) ? row.map(String) : []));
      } catch {
        /* drop malformed table */
      }
    }
    nodes[id] = table ? { ...r, table } : (r as MindNode);
  }
  return { ...(rest as unknown as Note), nodes };
}

const millis = (v: unknown): number => {
  const t = v as { toMillis?: () => number } | null;
  return t?.toMillis ? t.toMillis() : 0;
};

// --- Lifecycle -------------------------------------------------------------------
export async function startSync(userId: string) {
  await stopSync();
  const gen = ++generation;
  uid = userId;
  const f = await firestore();
  const { collection, query, where, onSnapshot, Timestamp } = await import("firebase/firestore");
  if (gen !== generation) return; // signed out / switched while loading
  const lastKey = keyFor(userId, "lastPull");
  const lastPull = (await kvGet<number>(lastKey)) ?? 0;
  if (gen !== generation) return;
  useSyncStatus.getState().set({ state: "syncing" });

  const notesQ = query(collection(f, "users", userId, "notes"), where("serverUpdatedAt", ">", Timestamp.fromMillis(lastPull)));
  unsubs.push(
    onSnapshot(
      notesQ,
      async (snap) => {
        if (gen !== generation) return;
        let maxSeen = (await kvGet<number>(lastKey)) ?? 0;
        let conflicts = 0;
        for (const change of snap.docChanges()) {
          if (change.doc.metadata.hasPendingWrites) continue; // our own write, not yet stamped
          if (change.type === "removed") {
            await db().notes.delete(change.doc.id);
            continue;
          }
          const data = change.doc.data();
          maxSeen = Math.max(maxSeen, millis(data.serverUpdatedAt));
          conflicts += await mergeRemote(fromRemote(data));
        }
        await kvSet(lastKey, maxSeen);
        const s = useSyncStatus.getState();
        s.set({ state: "synced", lastSyncedAt: Date.now(), conflicts: s.conflicts + conflicts });
      },
      (err) => {
        console.warn("sync listener", err);
        useSyncStatus.getState().set({ state: navigator.onLine ? "error" : "offline" });
      },
    ),
  );

  unsubs.push(
    onSnapshot(collection(f, "users", userId, "folders"), async (snap) => {
      if (gen !== generation) return;
      for (const change of snap.docChanges()) {
        if (change.doc.metadata.hasPendingWrites) continue;
        if (change.type === "removed") {
          await db().folders.delete(change.doc.id);
          continue;
        }
        const { serverUpdatedAt: _t, ...remote } = change.doc.data() as Folder & { serverUpdatedAt?: unknown };
        void _t;
        const local = await db().folders.get(remote.id);
        if (!local || local.updatedAt < remote.updatedAt) await db().folders.put({ ...remote, syncedAt: remote.updatedAt });
      }
    }),
  );

  window.addEventListener("online", onOnline);
  schedulePush(0);
}

export async function stopSync() {
  generation++;
  unsubs.forEach((u) => u());
  unsubs = [];
  uid = null;
  if (typeof window !== "undefined") window.removeEventListener("online", onOnline);
  useSyncStatus.getState().set({ state: "local", conflicts: 0, failed: 0 });
}

/** Returns 1 if a conflict copy was created. */
export async function mergeRemote(remote: Note): Promise<number> {
  const local = await db().notes.get(remote.id);
  if (!local) {
    await db().notes.put({ ...remote, syncedAt: remote.updatedAt });
    return 0;
  }
  if (remote.updatedAt === local.updatedAt) {
    if (local.syncedAt !== remote.updatedAt) await db().notes.update(local.id, { syncedAt: remote.updatedAt });
    return 0;
  }
  const localDirty = local.updatedAt > (local.syncedAt ?? 0);
  if (!localDirty) {
    if (remote.updatedAt > local.updatedAt) await db().notes.put({ ...remote, syncedAt: remote.updatedAt });
    return 0;
  }
  if (remote.updatedAt <= (local.syncedAt ?? 0)) return 0; // stale echo; our newer edit will be pushed
  // Both sides changed since last sync → keep newer, save older as a copy.
  const [winner, loser] = remote.updatedAt > local.updatedAt ? [remote, local] : [local, remote];
  const copy: Note = {
    ...loser,
    id: newId(),
    title: `${loser.title} (conflict copy)`,
    conflictOf: winner.id,
    syncedAt: null,
    updatedAt: Date.now(),
  };
  await db().notes.bulkPut([
    // A remote winner is clean; a local winner stays dirty so it overwrites the cloud.
    winner === remote ? { ...remote, syncedAt: remote.updatedAt } : { ...local, syncedAt: remote.updatedAt },
    copy,
  ]);
  schedulePush();
  return 1;
}

// --- Push -----------------------------------------------------------------------
const onOnline = () => schedulePush(0);

export function schedulePush(delay = PUSH_DEBOUNCE_MS) {
  if (!uid) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void pushNow(), delay);
}

async function pushNow() {
  if (!uid) return;
  if (pushing) {
    pushAgain = true;
    return;
  }
  if (!navigator.onLine) {
    useSyncStatus.getState().set({ state: "offline" });
    return;
  }
  const me = uid;
  const gen = generation;
  pushing = true;
  pushAgain = false;
  let failed = 0;
  try {
    const f = await firestore();
    const { doc, setDoc, deleteDoc, serverTimestamp } = await import("firebase/firestore");
    const dirty = await db().notes.filter((n) => n.updatedAt > (n.syncedAt ?? 0)).toArray();
    const dirtyFolders = await db().folders.filter((x) => x.updatedAt > (x.syncedAt ?? 0)).toArray();
    const delKey = keyFor(me, "pendingDeletes");
    const pendingDeletes = (await kvGet<string[]>(delKey)) ?? [];
    if (!dirty.length && !dirtyFolders.length && !pendingDeletes.length) {
      useSyncStatus.getState().set({ state: "synced", lastSyncedAt: Date.now(), failed: 0 });
      return;
    }
    useSyncStatus.getState().set({ state: "syncing" });

    // One write per document so a single bad document can't block the rest.
    const write = async <T,>(items: T[], fn: (x: T) => Promise<void>) => {
      for (let i = 0; i < items.length; i += 20) {
        const res = await Promise.allSettled(items.slice(i, i + 20).map(fn));
        res.forEach((r) => {
          if (r.status === "rejected") {
            failed++;
            console.warn("sync write failed", r.reason);
          }
        });
      }
    };

    await write(dirtyFolders, async (fo) => {
      const { syncedAt: _s, ...data } = fo;
      void _s;
      await setDoc(doc(f, "users", me, "folders", fo.id), { ...data, serverUpdatedAt: serverTimestamp() });
      await db().folders.update(fo.id, { syncedAt: fo.updatedAt });
    });

    await write(dirty, async (n) => {
      const data = toRemote(n);
      if (JSON.stringify(data).length > MAX_DOC_BYTES) throw new Error(`Note ${n.id} is too large to sync`);
      await setDoc(doc(f, "users", me, "notes", n.id), { ...data, serverUpdatedAt: serverTimestamp() });
      const cur = await db().notes.get(n.id);
      // Only mark synced if it wasn't edited again during the push.
      if (cur && cur.updatedAt === n.updatedAt) await db().notes.update(n.id, { syncedAt: n.updatedAt });
    });

    const deleted: string[] = [];
    await write(pendingDeletes, async (id) => {
      await deleteDoc(doc(f, "users", me, "notes", id));
      deleted.push(id);
    });
    if (deleted.length) {
      const now = (await kvGet<string[]>(delKey)) ?? [];
      await kvSet(delKey, now.filter((id) => !deleted.includes(id)));
    }
    if (gen === generation)
      useSyncStatus.getState().set({ state: failed ? "error" : "synced", lastSyncedAt: Date.now(), failed });
  } catch (e) {
    console.warn("sync push failed", e);
    useSyncStatus.getState().set({ state: navigator.onLine ? "error" : "offline" });
  } finally {
    pushing = false;
    if (pushAgain) schedulePush(500);
  }
}

/** Record a permanent delete so it also disappears from the cloud. */
export async function recordHardDelete(id: string) {
  if (!uid) return;
  const k = keyFor(uid, "pendingDeletes");
  const list = (await kvGet<string[]>(k)) ?? [];
  await kvSet(k, [...new Set([...list, id])]);
  schedulePush();
}
