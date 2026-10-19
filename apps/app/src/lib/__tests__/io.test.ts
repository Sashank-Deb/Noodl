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
