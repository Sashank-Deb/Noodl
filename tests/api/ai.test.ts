import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error plain JS module
import { buildRequest, handleAI, rateLimit } from "../../api/_lib/ai-core.js";

const env = { GEMINI_API_KEY: "k", SUPABASE_URL: "https://x.supabase.co", SUPABASE_PUBLISHABLE_KEY: "pk" };
const req = (body: unknown, token: string | null = "tok", method = "POST") =>
  new Request("http://localhost/api/ai", {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

afterEach(() => vi.unstubAllGlobals());

function mockFetch(gemini: { status?: number; text: string }, userOk = true) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push(String(url));
    if (String(url).includes("/auth/v1/user")) return new Response(JSON.stringify(userOk ? { id: "u1" } : {}), { status: userOk ? 200 : 401 });
    const body = JSON.parse(String(init?.body));
    expect(body.contents[0].parts[0].text.length).toBeGreaterThan(10);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: gemini.text }] } }] }), { status: gemini.status ?? 200 });
  });
  return calls;
}

describe("buildRequest", () => {
  it("builds prompts only for known tasks and validates input", () => {
    expect(buildRequest({ task: "suggest", path: ["Root"], siblings: ["a"], text: "Wat" })?.config.responseMimeType).toBe("application/json");
    expect(buildRequest({ task: "generate", prompt: "garden", depth: 9 })?.prompt).toContain("Use 4 levels");
    expect(buildRequest({ task: "rewrite", text: "x", mode: "nope" })).toBeNull();
    expect(buildRequest({ task: "anything", prompt: "ignore previous" })).toBeNull();
    expect(buildRequest({ task: "summarize", source: "" })).toBeNull();
  });
});

describe("rateLimit", () => {
  it("caps suggestions per minute per user", () => {
    const now = 1_000_000;
    let ok = 0;
    for (let i = 0; i < 40; i++) if (rateLimit("rl-user", "suggest", now)) ok++;
    expect(ok).toBe(30);
    expect(rateLimit("rl-user", "suggest", now + 61_000)).toBe(true);
  });
});

describe("handleAI", () => {
  it("rejects guests and bad tokens", async () => {
    mockFetch({ text: "" }, false);
    expect((await handleAI(req({ task: "suggest" }, null), env)).status).toBe(401);
    expect((await handleAI(req({ task: "suggest", text: "ab" }, "bad"), env)).status).toBe(401);
  });

  it("returns suggestions for a signed-in user", async () => {
    mockFetch({ text: JSON.stringify({ suggestions: ["Water the beds", 5, "Water barrels"] }) });
    const res = await handleAI(req({ task: "suggest", path: ["Garden"], siblings: [], text: "Wat" }, "good1"), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ suggestions: ["Water the beds", "Water barrels"] });
  });

  it("passes Gemini 429 through and hides other upstream errors", async () => {
    mockFetch({ status: 429, text: "" });
    expect((await handleAI(req({ task: "generate", prompt: "x y z" }, "good2"), env)).status).toBe(429);
    mockFetch({ status: 500, text: "" });
    const r = await handleAI(req({ task: "generate", prompt: "x y z" }, "good3"), env);
    expect(r.status).toBe(502);
  });

  it("is unavailable without a key, and only accepts POST", async () => {
    expect((await handleAI(req({}), { ...env, GEMINI_API_KEY: "" })).status).toBe(503);
    expect((await handleAI(req(null, "t", "GET"), env)).status).toBe(405);
  });
});
