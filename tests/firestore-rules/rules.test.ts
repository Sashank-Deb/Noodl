/**
 * Firestore security rules tests. Needs the Firestore emulator (Java):
 *   pnpm --filter firestore-rules-tests emulator:test
 * CI runs this automatically (.github/workflows/ci.yml).
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";

let env: RulesTestEnvironment;

const note = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: "Plan",
  rootId: "r",
  nodes: { r: { id: "r", parentId: null, children: [], text: "Plan", type: "text" } },
  mapStyle: "curved",
  folderId: null,
  createdAt: 1,
  updatedAt: 2,
  serverUpdatedAt: serverTimestamp(),
  ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-noodl",
    firestore: { rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8") },
  });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => env.clearFirestore());

describe("notes", () => {
  it("owner can create, read, update and delete their notes", async () => {
    const db = env.authenticatedContext("alice").firestore();
    const ref = doc(db, "users/alice/notes/n1");
    await assertSucceeds(setDoc(ref, note("n1")));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(setDoc(ref, note("n1", { title: "Plan 2", updatedAt: 3 })));
    await assertSucceeds(deleteDoc(ref));
  });

  it("other users and guests cannot read or write", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/alice/notes/n1"), { ...note("n1"), serverUpdatedAt: Timestamp.now() });
    });
    const bob = env.authenticatedContext("bob").firestore();
    const guest = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(bob, "users/alice/notes/n1")));
    await assertFails(getDoc(doc(guest, "users/alice/notes/n1")));
    await assertFails(setDoc(doc(bob, "users/alice/notes/n2"), note("n2")));
    await assertFails(deleteDoc(doc(bob, "users/alice/notes/n1")));
  });

  it("rejects mismatched ids, missing fields and client-chosen timestamps", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(db, "users/alice/notes/n1"), note("other")));
    await assertFails(setDoc(doc(db, "users/alice/notes/n1"), { ...note("n1"), nodes: "nope" }));
    await assertFails(setDoc(doc(db, "users/alice/notes/n1"), { ...note("n1"), serverUpdatedAt: Timestamp.fromMillis(0) }));
  });
});

describe("folders", () => {
  it("owner can write folders with sane names", async () => {
    const db = env.authenticatedContext("alice").firestore();
    const f = { id: "f1", name: "Work", createdAt: 1, updatedAt: 1, serverUpdatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db, "users/alice/folders/f1"), f));
    await assertFails(setDoc(doc(db, "users/alice/folders/f1"), { ...f, name: "x".repeat(201) }));
    await assertFails(setDoc(doc(env.authenticatedContext("bob").firestore(), "users/alice/folders/f2"), { ...f, id: "f2" }));
  });
});

describe("everything else", () => {
  it("is closed", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(db, "public/x"), { a: 1 }));
    await assertFails(getDoc(doc(db, "users/alice")));
  });
});
