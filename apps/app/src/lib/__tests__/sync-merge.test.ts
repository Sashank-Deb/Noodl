import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, saveNote } from "../db";
import { mergeRemote } from "../sync";
import { noteFromOutline } from "../tree";

const base = () => {
  const n = noteFromOutline({ text: "Plan", children: [{ text: "A" }] });
  n.updatedAt = 1000;
  n.syncedAt = 1000;
  return n;
};

describe("sync merge", () => {
  beforeEach(async () => {
    await db().notes.clear();
  });

  it("inserts unknown remote notes as synced", async () => {
    const r = base();
    expect(await mergeRemote(r)).toBe(0);
    expect((await db().notes.get(r.id))?.syncedAt).toBe(1000);
  });

  it("takes newer remote when local is clean", async () => {
    const l = base();
    await saveNote(l);
    const r = { ...l, title: "Remote", updatedAt: 2000 };
    expect(await mergeRemote(r)).toBe(0);
    expect((await db().notes.get(l.id))?.title).toBe("Remote");
  });

  it("ignores the echo of our own write", async () => {
    const l = base();
    await saveNote(l);
    expect(await mergeRemote({ ...l })).toBe(0);
    expect(await db().notes.count()).toBe(1);
  });

  it("keeps both versions on a true conflict", async () => {
    const l = { ...base(), title: "Local edit", updatedAt: 3000 }; // dirty: updatedAt > syncedAt
    await saveNote(l);
    const r = { ...base(), id: l.id, rootId: l.rootId, nodes: l.nodes, title: "Remote edit", updatedAt: 2500 };
    expect(await mergeRemote(r)).toBe(1);
    const all = await db().notes.toArray();
    expect(all.length).toBe(2);
    expect(all.find((n) => n.id === l.id)?.title).toBe("Local edit");
    expect(all.find((n) => n.conflictOf === l.id)?.title).toBe("Remote edit (conflict copy)");
  });
});
