/**
 * Optional cloud mirror in Firestore: users/{uid}/notes/{noteId}.
 *
 * Cost design (stays inside the free Spark quota):
 *  - one document per note (the whole node tree), so opening a note is 0 reads
 *    (it's local) and a sync of an edited note is 1 write;
 *  - pushes are debounced and batched; only notes with updatedAt > syncedAt go up;
 *  - the realtime listener only queries docs changed since the last pull, so a
 *    returning device reads just what changed, not the whole library;
 *  - images are not synced (Cloud Storage requires the paid Blaze plan).
 * Conflicts (edited on two devices while offline) keep the newer version and
 * save the other as a "conflict copy" note, like MindNote's recovery page.
 */
import type { Firestore, Unsubscribe } from "firebase/firestore";
import { create } from "zustand";
import { db, kvGet, kvSet } from "./db";
import { getFirebaseApp } from "./firebase";
import type { Folder, Note } from "./types";
import { newId } from "./tree";

export type SyncState = "local" | "syncing" | "synced" | "offline" | "error";
export const useSyncStatus = create<{ state: SyncState; lastSyncedAt: number | null; conflicts: number; set: (p: Partial<{ state: SyncState; lastSyncedAt: number | null; conflicts: number }>) => void }>((set) => ({
  state: "local",
  lastSyncedAt: null,
  conflicts: 0,
  set: (p) => set(p),
}));

let fs: Firestore | null = null;
let uid: string | null = null;
let unsubs: Unsubscribe[] = [];
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing = false;

const PUSH_DEBOUNCE_MS = 3000;
const MAX_DOC_BYTES = 900_000; // Firestore limit is 1 MiB per document

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

function toRemote(n: Note) {
  // Strip local-only fields.
  const { syncedAt: _s, ...rest } = n;
  void _s;
  return rest;
}

export async function startSync(userId: string) {
  await stopSync();
  uid = userId;
  const f = await firestore();
  const { collection, query, where, onSnapshot } = await import("firebase/firestore");
  const lastKey = `sync:${userId}:lastPull`;
  const lastPull = (await kvGet<number>(lastKey)) ?? 0;
  useSyncStatus.getState().set({ state: "syncing" });

  const notesQ = query(collection(f, "users", userId, "notes"), where("updatedAt", ">", lastPull));
  unsubs.push(
    onSnapshot(
      notesQ,
      async (snap) => {
        let maxSeen = (await kvGet<number>(lastKey)) ?? 0;
        let conflicts = 0;
        for (const change of snap.docChanges()) {
          if (change.type === "removed") continue;
          const remote = change.doc.data() as Note;
          maxSeen = Math.max(maxSeen, remote.updatedAt);
          conflicts += await mergeRemote(remote);
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

  const foldersQ = collection(f, "users", userId, "folders");
  unsubs.push(
    onSnapshot(foldersQ, async (snap) => {
      for (const change of snap.docChanges()) {
        const remote = change.doc.data() as Folder;
        if (change.type === "removed") {
          await db().folders.delete(change.doc.id);
          continue;
        }
        const local = await db().folders.get(remote.id);
        if (!local || local.updatedAt < remote.updatedAt) await db().folders.put(remote);
      }
    }),
  );

  window.addEventListener("online", onOnline);
  schedulePush(0);
}

export async function stopSync() {
  unsubs.forEach((u) => u());
  unsubs = [];
  uid = null;
  if (typeof window !== "undefined") window.removeEventListener("online", onOnline);
  useSyncStatus.getState().set({ state: "local" });
}

/** Returns 1 if a conflict copy was created. */
async function mergeRemote(remote: Note): Promise<number> {
  const local = await db().notes.get(remote.id);
  if (!local) {
    await db().notes.put({ ...remote, syncedAt: remote.updatedAt });
    return 0;
  }
  if (remote.updatedAt <= local.updatedAt && local.syncedAt === local.updatedAt) return 0; // echo
  if (remote.updatedAt === local.updatedAt) {
    await db().notes.update(local.id, { syncedAt: remote.updatedAt });
    return 0;
  }
  const localDirty = local.updatedAt > (local.syncedAt ?? 0);
  if (!localDirty) {
    if (remote.updatedAt > local.updatedAt) await db().notes.put({ ...remote, syncedAt: remote.updatedAt });
    return 0;
  }
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
    { ...winner, syncedAt: winner === remote ? remote.updatedAt : local.syncedAt },
    copy,
  ]);
  schedulePush();
  return 1;
}

const onOnline = () => schedulePush(0);

export function schedulePush(delay = PUSH_DEBOUNCE_MS) {
  if (!uid) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void pushNow(), delay);
}

async function pushNow() {
  if (!uid || pushing) return;
  if (!navigator.onLine) {
    useSyncStatus.getState().set({ state: "offline" });
    return;
  }
  pushing = true;
  try {
    const f = await firestore();
    const { doc, writeBatch, deleteDoc } = await import("firebase/firestore");
    const dirty = await db().notes.filter((n) => n.updatedAt > (n.syncedAt ?? 0)).toArray();
    const folders = await db().folders.toArray();
    const pendingDeletes = (await kvGet<string[]>("sync:pendingDeletes")) ?? [];
    if (!dirty.length && !pendingDeletes.length) {
      useSyncStatus.getState().set({ state: "synced", lastSyncedAt: Date.now() });
      return;
    }
    useSyncStatus.getState().set({ state: "syncing" });
    // Batches of up to 400 writes (Firestore allows 500).
    for (let i = 0; i < dirty.length; i += 400) {
      const batch = writeBatch(f);
      for (const n of dirty.slice(i, i + 400)) {
        const data = toRemote(n);
        if (JSON.stringify(data).length > MAX_DOC_BYTES) {
          console.warn(`Note ${n.id} is too large to sync`);
          continue;
        }
        batch.set(doc(f, "users", uid, "notes", n.id), data);
      }
      for (const fo of folders) batch.set(doc(f, "users", uid, "folders", fo.id), fo);
      await batch.commit();
    }
    for (const id of pendingDeletes) await deleteDoc(doc(f, "users", uid, "notes", id));
    await kvSet("sync:pendingDeletes", []);
    await db().transaction("rw", db().notes, async () => {
      for (const n of dirty) {
        const cur = await db().notes.get(n.id);
        // Only mark synced if it wasn't edited again during the push.
        if (cur && cur.updatedAt === n.updatedAt) await db().notes.update(n.id, { syncedAt: n.updatedAt });
      }
    });
    useSyncStatus.getState().set({ state: "synced", lastSyncedAt: Date.now() });
  } catch (e) {
    console.warn("sync push failed", e);
    useSyncStatus.getState().set({ state: navigator.onLine ? "error" : "offline" });
  } finally {
    pushing = false;
  }
}

/** Record a permanent delete so it also disappears from the cloud. */
export async function recordHardDelete(id: string) {
  if (!uid) return;
  const list = (await kvGet<string[]>("sync:pendingDeletes")) ?? [];
  await kvSet("sync:pendingDeletes", [...new Set([...list, id])]);
  schedulePush();
}

export async function deleteRemoteFolder(id: string) {
  if (!uid) return;
  const f = await firestore();
  const { doc, deleteDoc } = await import("firebase/firestore");
  await deleteDoc(doc(f, "users", uid, "folders", id)).catch(() => {});
}
