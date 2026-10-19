/**
 * Optional cloud mirror in Supabase Postgres (tables `notes` and `folders`,
 * see supabase/migrations). Row-level security limits every row to its owner.
 *
 * Cost design (stays inside the free plan):
 *  - one row per note (the whole node tree as jsonb), so opening a note is 0
 *    reads (it's local) and syncing an edited note is 1 upsert;
 *  - pushes are debounced; only notes/folders with updatedAt > syncedAt go up;
 *  - pulls ask only for rows whose *server* timestamp is newer than the last
 *    pull (immune to device clock skew), and realtime pushes changes as they
 *    happen while the app is open;
 *  - images are not synced.
 * Deletes are tombstones (deletedAt) so they reach every device; permanent
 * deletes remove the row and other devices apply the removal.
 * Conflicts keep the newer version and save the other as a conflict copy,
 * which the conflict review dialog lets the user resolve.
 */
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";
import { db, kvGet, kvSet } from "./db";
import { getSupabase } from "./supabase";
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

let sb: SupabaseClient | null = null;
let uid: string | null = null;
let generation = 0;
let channel: RealtimeChannel | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing = false;
let pushAgain = false;
let pulling = false;

const PUSH_DEBOUNCE_MS = 3000;
const MAX_DOC_BYTES = 900_000;
const PAGE = 500;
const keyFor = (u: string, k: string) => `sync:${u}:${k}`;

interface Row {
  id: string;
  data: Record<string, unknown>;
  updated_at: number;
  deleted_at: number | null;
  server_updated_at: string;
}

// --- Encoding (tables as JSON strings: keeps rows compatible with older clients) ---
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
  const { serverUpdatedAt: _t, ...rest } = data ?? {};
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

// --- Lifecycle -------------------------------------------------------------------
export async function startSync(userId: string) {
  await stopSync();
  const gen = ++generation;
  uid = userId;
  const client = await getSupabase();
  if (gen !== generation) return; // signed out / switched while loading
  sb = client;
  useSyncStatus.getState().set({ state: "syncing" });

  // Realtime: rows changed on other devices while we're open.
  channel = client
    .channel(`noodl-${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "notes", filter: `user_id=eq.${userId}` }, (p) => {
      if (gen !== generation) return;
      if (p.eventType === "DELETE") {
        const id = (p.old as Partial<Row>).id;
        if (id) void db().notes.delete(id);
        return;
      }
      const row = p.new as Row;
      void mergeRemote(fromRemote(row.data)).then((c) => {
        if (c) bumpConflicts(c);
      });
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "folders", filter: `user_id=eq.${userId}` }, (p) => {
      if (gen !== generation) return;
      if (p.eventType === "DELETE") {
        const id = (p.old as Partial<Row>).id;
        if (id) void db().folders.delete(id);
        return;
      }
      void mergeFolder((p.new as Row).data as unknown as Folder);
    })
    .subscribe((status) => {
      // Catch up on anything missed before (or while) the channel connected.
      if (status === "SUBSCRIBED") void pull(gen);
    });

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  await pull(gen);
  schedulePush(0);
}

export async function stopSync() {
  generation++;
  if (channel && sb) void sb.removeChannel(channel);
  channel = null;
  uid = null;
  if (typeof window !== "undefined") {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
  }
  useSyncStatus.getState().set({ state: "local", conflicts: 0, failed: 0 });
}

function bumpConflicts(n: number) {
  const s = useSyncStatus.getState();
  s.set({ conflicts: s.conflicts + n });
}

/** Incremental pull of rows changed since the last pull (by server time). */
async function pull(gen = generation) {
  if (!sb || !uid || pulling) return;
  pulling = true;
  const me = uid;
  try {
    for (const table of ["folders", "notes"] as const) {
      const key = keyFor(me, `lastPull:${table}`);
      let since = (await kvGet<string>(key)) ?? "1970-01-01T00:00:00Z";
      for (;;) {
        const { data, error } = await sb
          .from(table)
          .select("id,data,updated_at,deleted_at,server_updated_at")
          .gt("server_updated_at", since)
          .order("server_updated_at", { ascending: true })
          .limit(PAGE);
        if (error) throw error;
        if (gen !== generation) return;
        const rows = (data ?? []) as Row[];
        let conflicts = 0;
        for (const r of rows) {
          if (table === "notes") conflicts += await mergeRemote(fromRemote(r.data));
          else await mergeFolder(r.data as unknown as Folder);
        }
        if (conflicts) bumpConflicts(conflicts);
        if (rows.length) {
          since = rows[rows.length - 1].server_updated_at;
          await kvSet(key, since);
        }
        if (rows.length < PAGE) break;
      }
    }
    useSyncStatus.getState().set({ state: "synced", lastSyncedAt: Date.now() });
  } catch (e) {
    console.warn("sync pull failed", e);
    useSyncStatus.getState().set({ state: navigator.onLine ? "error" : "offline" });
  } finally {
    pulling = false;
  }
}

async function mergeFolder(remote: Folder) {
  const local = await db().folders.get(remote.id);
  if (!local || local.updatedAt < remote.updatedAt) await db().folders.put({ ...remote, syncedAt: remote.updatedAt });
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
const onOnline = () => {
  void pull();
  schedulePush(0);
};
const onVisible = () => {
  if (document.visibilityState === "visible") void pull();
};

export function schedulePush(delay = PUSH_DEBOUNCE_MS) {
  if (!uid) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void pushNow(), delay);
}

async function pushNow() {
  if (!uid || !sb) return;
  if (pushing) {
    pushAgain = true;
    return;
  }
  if (!navigator.onLine) {
    useSyncStatus.getState().set({ state: "offline" });
    return;
  }
  const me = uid;
  const client = sb;
  const gen = generation;
  pushing = true;
  pushAgain = false;
  let failed = 0;
  try {
    const dirty = await db().notes.filter((n) => n.updatedAt > (n.syncedAt ?? 0)).toArray();
    const dirtyFolders = await db().folders.filter((x) => x.updatedAt > (x.syncedAt ?? 0)).toArray();
    const delKey = keyFor(me, "pendingDeletes");
    const pendingDeletes = (await kvGet<string[]>(delKey)) ?? [];
    if (!dirty.length && !dirtyFolders.length && !pendingDeletes.length) {
      useSyncStatus.getState().set({ state: "synced", lastSyncedAt: Date.now(), failed: 0 });
      return;
    }
    useSyncStatus.getState().set({ state: "syncing" });

    // One request per row so a single bad row can't block the rest.
    const write = async <T,>(items: T[], fn: (x: T) => Promise<void>) => {
      for (let i = 0; i < items.length; i += 10) {
        const res = await Promise.allSettled(items.slice(i, i + 10).map(fn));
        res.forEach((r) => {
          if (r.status === "rejected") {
            failed++;
            console.warn("sync write failed", r.reason);
          }
        });
      }
    };
    const upsert = async (table: "notes" | "folders", id: string, data: Record<string, unknown>, updatedAt: number, deletedAt: number | null | undefined) => {
      const { error } = await client
        .from(table)
        .upsert({ user_id: me, id, data, updated_at: updatedAt, deleted_at: deletedAt ?? null }, { onConflict: "user_id,id" });
      if (error) throw error;
    };

    await write(dirtyFolders, async (fo) => {
      const { syncedAt: _s, ...data } = fo;
      void _s;
      await upsert("folders", fo.id, data as unknown as Record<string, unknown>, fo.updatedAt, fo.deletedAt);
      await db().folders.update(fo.id, { syncedAt: fo.updatedAt });
    });

    await write(dirty, async (n) => {
      const data = toRemote(n);
      if (JSON.stringify(data).length > MAX_DOC_BYTES) throw new Error(`Note ${n.id} is too large to sync`);
      await upsert("notes", n.id, data, n.updatedAt, n.deletedAt);
      const cur = await db().notes.get(n.id);
      // Only mark synced if it wasn't edited again during the push.
      if (cur && cur.updatedAt === n.updatedAt) await db().notes.update(n.id, { syncedAt: n.updatedAt });
    });

    const deleted: string[] = [];
    await write(pendingDeletes, async (id) => {
      const { error } = await client.from("notes").delete().eq("user_id", me).eq("id", id);
      if (error) throw error;
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
