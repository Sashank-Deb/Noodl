import { describe, expect, it } from "vitest";
import * as T from "../tree";

const sample = () =>
  T.noteFromOutline({ text: "Root", children: [{ text: "A", children: [{ text: "A1" }, { text: "A2" }] }, { text: "B" }] });
const find = (n: ReturnType<typeof sample>, text: string) => Object.values(n.nodes).find((x) => x.text === text)!.id;

describe("tree ops", () => {
  it("builds from outline and round-trips", () => {
    const n = sample();
    expect(T.validateNote(n)).toEqual([]);
    expect(T.toOutline(n)).toEqual({ text: "Root", children: [{ text: "A", children: [{ text: "A1" }, { text: "A2" }] }, { text: "B" }] });
  });
  it("adds child and sibling in the right place", () => {
    const n = sample();
    const a1 = find(n, "A1");
    const s = T.addSibling(n, a1, "A1.5");
    expect(n.nodes[find(n, "A")].children.map((c) => n.nodes[c].text)).toEqual(["A1", "A1.5", "A2"]);
    T.addChild(n, s, "deep");
    expect(T.depthOf(n, find(n, "deep"))).toBe(3);
    expect(T.validateNote(n)).toEqual([]);
  });
  it("sibling of root becomes child", () => {
    const n = sample();
    T.addSibling(n, n.rootId, "C");
    expect(n.nodes[n.rootId].children.length).toBe(3);
  });
  it("removes subtree and returns next selection", () => {
    const n = sample();
    const next = T.removeNode(n, find(n, "A"));
    expect(n.nodes[next!].text).toBe("B");
    expect(Object.keys(n.nodes).length).toBe(2);
    expect(T.removeNode(n, n.rootId)).toBeNull();
    expect(T.validateNote(n)).toEqual([]);
  });
  it("prevents cycles on move", () => {
    const n = sample();
    expect(T.moveNode(n, find(n, "A"), find(n, "A1"))).toBe(false);
    expect(T.moveNode(n, find(n, "B"), find(n, "A1"))).toBe(true);
    expect(T.ancestorsText(n, find(n, "B"))).toEqual(["Root", "A", "A1"]);
    expect(T.validateNote(n)).toEqual([]);
  });
  it("moves within same parent with correct index", () => {
    const n = sample();
    const a = find(n, "A");
    T.addChild(n, a, "A3");
    T.moveNode(n, find(n, "A1"), a, 3);
    expect(n.nodes[a].children.map((c) => n.nodes[c].text)).toEqual(["A2", "A3", "A1"]);
  });
  it("indents and outdents", () => {
    const n = sample();
    const b = find(n, "B");
    expect(T.indent(n, b)).toBe(true);
    expect(n.nodes[b].parentId).toBe(find(n, "A"));
    expect(T.outdent(n, b)).toBe(true);
    expect(n.nodes[b].parentId).toBe(n.rootId);
    expect(n.nodes[n.rootId].children.indexOf(b)).toBe(1);
    expect(T.indent(n, find(n, "A"))).toBe(false);
  });
  it("expand to level and flatten", () => {
    const n = sample();
    T.expandToLevel(n, 1);
    expect(T.flattenVisible(n).map((x) => n.nodes[x.id].text)).toEqual(["Root", "A", "B"]);
    T.expandToLevel(n, Infinity);
    expect(T.flattenVisible(n).length).toBe(5);
  });
  it("branch index and clone", () => {
    const n = sample();
    expect(T.branchIndex(n, find(n, "A2"))).toBe(0);
    expect(T.branchIndex(n, find(n, "B"))).toBe(1);
    const c = T.cloneNote(n, "Copy");
    expect(c.id).not.toBe(n.id);
    expect(c.nodes[c.rootId].text).toBe("Copy");
    expect(T.countNodes(c)).toBe(5);
  });
});
