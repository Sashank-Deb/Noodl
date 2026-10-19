import { describe, expect, it } from "vitest";
import { localIndex } from "../ai/local-suggest";

describe("local suggestions", () => {
  it("prefix phrases first, then word completions, keeps casing", () => {
    localIndex.clear();
    ["Marketing plan", "Market research", "Marketing plan", "Meeting notes", "Quarterly marketplace review"].forEach((t) => localIndex.add(t));
    const s = localIndex.suggest("Mark");
    expect(s[0]).toBe("Marketing plan");
    expect(s).toContain("Market research");
    expect(localIndex.suggest("Review the mark")).toEqual(expect.arrayContaining(["Review the marketing"]));
    expect(localIndex.suggest("Marketing plan")).not.toContain("Marketing plan");
  });
});
