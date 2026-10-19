import { describe, expect, it } from "vitest";
import { fromJSON, fromMarkdown, toJSON, toMarkdown, fromIndentedText, toHTML } from "../io";
import { noteFromOutline, toOutline } from "../tree";

const outline = { text: "Plan", children: [{ text: "Goals", children: [{ text: "Ship v1" }] }, { text: "Docs", type: "link" as const, url: "https://example.com" }] };

describe("io", () => {
  it("markdown round trip", () => {
    const md = toMarkdown(noteFromOutline(outline));
    expect(md).toContain("# Plan");
    expect(md).toContain("  - Ship v1");
    expect(toOutline(fromMarkdown(md))).toEqual(outline);
  });
  it("markdown headings + numbered lists", () => {
    const n = fromMarkdown("# Trip\n## Day 1\n1. Museum\n2. Lunch\n   - pasta\n## Day 2\nBeach day");
    expect(toOutline(n)).toEqual({
      text: "Trip",
      children: [
        { text: "Day 1", children: [{ text: "Museum" }, { text: "Lunch", children: [{ text: "pasta" }] }] },
        { text: "Day 2", children: [{ text: "Beach day" }] },
      ],
    });
  });
  it("json round trip and foreign json", () => {
    const n = fromJSON(toJSON(noteFromOutline(outline)));
    expect(toOutline(n)).toEqual(outline);
    expect(toOutline(fromJSON(JSON.stringify({ title: "X", children: ["a", { name: "b", children: [] }] })))).toEqual({ text: "X", children: [{ text: "a" }, { text: "b" }] });
  });
  it("indented text", () => {
    expect(fromIndentedText("Root\n  - a\n    - a1\n  - b")).toEqual([{ text: "Root", children: [{ text: "a", children: [{ text: "a1", children: [] }] }, { text: "b", children: [] }] }]);
  });
  it("html escapes", () => {
    expect(toHTML(noteFromOutline({ text: "<x>" }))).toContain("&lt;x&gt;");
  });
});

describe("sanitising", () => {
  it("drops javascript: links and bad shapes on import", async () => {
    const { safeUrl } = await import("../tree");
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("example.com")).toBe("https://example.com");
    const n = fromMarkdown("# T\n- [x](javascript:void)\n- [y](javascript:alert(1))");
    expect(Object.values(n.nodes).every((x) => x.type === "text")).toBe(true);
    expect(toHTML(n)).not.toContain('href="javascript');
    const j = fromJSON(JSON.stringify({ app: "noodl", kind: "note", version: 1, outline: { text: 5, children: [{ text: "t", type: "table", table: "nope" }] } }));
    expect(j.nodes[j.rootId].text).toBe("5");
    expect(Object.values(j.nodes).every((x) => typeof x.text === "string" && x.type === "text")).toBe(true);
  });
});
