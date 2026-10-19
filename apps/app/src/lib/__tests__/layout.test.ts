import { describe, expect, it } from "vitest";
import { layoutTree, connectorPath, measureText } from "../layout";
import { noteFromOutline } from "../tree";

const measure = () => ({ w: 100, h: 30 });

describe("layout", () => {
  it("places children right of parent, centred, without overlap", () => {
    const n = noteFromOutline({ text: "R", children: [{ text: "a" }, { text: "b" }, { text: "c" }] });
    const { boxes } = layoutTree(n, measure, { hGap: 50, vGap: 10 });
    const kids = n.nodes[n.rootId].children.map((c) => boxes[c]);
    expect(kids.every((k) => k.x === 150)).toBe(true);
    for (let i = 1; i < kids.length; i++) expect(kids[i].y).toBeGreaterThanOrEqual(kids[i - 1].y + 30 + 10);
    const mid = (kids[0].y + kids[2].y + 30) / 2;
    expect(mid).toBeCloseTo(boxes[n.rootId].y + 15);
  });
  it("skips collapsed subtrees", () => {
    const n = noteFromOutline({ text: "R", children: [{ text: "a", children: [{ text: "x" }] }] });
    const a = n.nodes[n.rootId].children[0];
    n.nodes[a].collapsed = true;
    const { boxes } = layoutTree(n, measure);
    expect(Object.keys(boxes).length).toBe(2);
  });
  it("balanced mode uses both sides", () => {
    const n = noteFromOutline({ text: "R", children: ["a", "b", "c", "d"].map((text) => ({ text })) });
    const { boxes } = layoutTree(n, measure, { balanced: true });
    const sides = n.nodes[n.rootId].children.map((c) => boxes[c].side);
    expect(sides).toContain(1);
    expect(sides).toContain(-1);
  });
  it("subtrees never overlap vertically", () => {
    const n = noteFromOutline({
      text: "R",
      children: [{ text: "a", children: [{ text: "a1" }, { text: "a2" }, { text: "a3" }] }, { text: "b", children: [{ text: "b1" }, { text: "b2" }] }],
    });
    const { boxes } = layoutTree(n, measure, { vGap: 10 });
    const leaves = Object.values(n.nodes).filter((x) => !x.children.length).map((x) => boxes[x.id]).sort((p, q) => p.y - q.y);
    for (let i = 1; i < leaves.length; i++) expect(leaves[i].y).toBeGreaterThanOrEqual(leaves[i - 1].y + 30);
  });
  it("connector paths are valid", () => {
    const p = { x: 0, y: 0, w: 100, h: 30, side: 0 as const, depth: 0 };
    const c = { x: 150, y: 60, w: 100, h: 30, side: 1 as const, depth: 1 };
    expect(connectorPath(p, c, "curved")).toMatch(/^M100,15 C/);
    expect(connectorPath(p, c, "elbow")).toMatch(/^M100,15 L/);
  });
  it("measures wrapped text with fallback", () => {
    const s = measureText("one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty", "14px sans-serif", 120);
    expect(s.h).toBeGreaterThan(20);
    expect(s.w).toBeLessThanOrEqual(120);
  });
});
