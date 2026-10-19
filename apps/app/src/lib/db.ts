/**
 * Local-first storage. Everything lives in IndexedDB first; the cloud is an
 * optional mirror (see sync.ts). This is what keeps hosting costs ~zero:
 * reading/writing notes never touches a server.
 */
import Dexie, { type EntityTable } from "dexie";
import type { Asset, Folder, Note, Settings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { sanitizeNote } from "./tree";

interface KV {
  key: string;
  value: unknown;
}

class MindNoteDB extends Dexie {
  notes!: EntityTable<Note, "id">;
  folders!: EntityTable<Folder, "id">;
  assets!: EntityTable<Asset, "id">;
  kv!: EntityTable<KV, "key">;

  constructor() {
    super("mindnote");
    this.version(1).stores({
      notes: "id, folderId, updatedAt, deletedAt",
      folders: "id, updatedAt, deletedAt",
      assets: "id, noteId",
      kv: "key",
    });
  }
}

let _db: MindNoteDB | null = null;
export function db(): MindNoteDB {
  if (!_db) _db = new MindNoteDB();
  return _db;
}

export const RECYCLE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function saveNote(note: Note) {
  await db().notes.put(note);
}

export async function getNote(id: string) {
  return db().notes.get(id);
}

export async function softDeleteNote(id: string) {
  await db().notes.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
}

export async function restoreNote(id: string) {
  await db().notes.update(id, { deletedAt: null, updatedAt: Date.now() });
}

export async function hardDeleteNote(id: string) {
  await db().transaction("rw", db().notes, db().assets, async () => {
    await db().notes.delete(id);
    await db().assets.where("noteId").equals(id).delete();
  });
}

/** Removes every note, folder and image from this device (used on sign-out). */
export async function clearLocalData() {
  await db().transaction("rw", db().notes, db().folders, db().assets, async () => {
    await db().notes.clear();
    await db().folders.clear();
    await db().assets.clear();
  });
}

/** Removes recycle-bin items older than the retention window. */
export async function purgeRecycleBin(now = Date.now()) {
  const old = await db()
    .notes.filter((n) => !!n.deletedAt && now - (n.deletedAt as number) > RECYCLE_RETENTION_MS)
    .primaryKeys();
  for (const id of old) await hardDeleteNote(id);
  return old.length;
}

export async function saveFolder(folder: Folder) {
  await db().folders.put(folder);
}

export async function deleteFolder(id: string) {
  // Notes in a deleted folder move to "All notes" rather than vanish. The folder
  // becomes a tombstone so the delete syncs to other devices.
  const now = Date.now();
  await db().transaction("rw", db().folders, db().notes, async () => {
    await db().notes.where("folderId").equals(id).modify({ folderId: null, updatedAt: now });
    await db().folders.update(id, { deletedAt: now, updatedAt: now });
  });
}

export async function getSettings(): Promise<Settings> {
  const row = await db().kv.get("settings");
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function setSettings(s: Settings) {
  await db().kv.put({ key: "settings", value: s });
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await db().kv.get(key))?.value as T | undefined;
}
export async function kvSet(key: string, value: unknown) {
  await db().kv.put({ key, value });
}

// ---------------------------------------------------------------------------
// Images: compressed on the device and stored locally only.
// ---------------------------------------------------------------------------
export async function saveImageAsset(noteId: string, file: Blob, id: string) {
  const { blob, width, height } = await compressImage(file);
  await db().assets.put({ id, noteId, blob, width, height, createdAt: Date.now() });
  return { width, height };
}

async function compressImage(file: Blob, maxSide = 1280, quality = 0.82) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  const blob: Blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/webp", quality),
  );
  return { blob, width, height };
}

// ---------------------------------------------------------------------------
// Full backup (Settings → Export backup) — also the "raw backup" for recovery.
// ---------------------------------------------------------------------------
export interface Backup {
  app: "mindnote-web";
  version: 1;
  exportedAt: number;
  notes: Note[];
  folders: Folder[];
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: "mindnote-web",
    version: 1,
    exportedAt: Date.now(),
    notes: await db().notes.toArray(),
    folders: await db().folders.toArray(),
  };
}

export async function importBackup(b: Backup) {
  if (b?.app !== "mindnote-web" || !Array.isArray(b.notes)) throw new Error("Not a MindNote backup file");
  await db().transaction("rw", db().notes, db().folders, async () => {
    // syncedAt is reset so restored data is uploaded if sync is on.
    for (const f of b.folders ?? []) {
      const cur = await db().folders.get(f.id);
      if (!cur || cur.updatedAt < f.updatedAt) await db().folders.put({ ...f, syncedAt: null });
    }
    for (const n of b.notes) {
      const cur = await db().notes.get(n.id);
      if (!cur || cur.updatedAt < n.updatedAt) await db().notes.put({ ...sanitizeNote(n), syncedAt: null });
    }
  });
  return b.notes.length;
}
