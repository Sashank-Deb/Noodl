/**
 * AI calls go to our own serverless function (/api/ai on Vercel), which holds
 * the AI keys (Groq, Gemini as backup; free tiers), checks the caller's
 * Supabase session and rate-limits per user. AI is for signed-in users only;
 * guests (and anyone offline / rate-limited / with AI off) get local
 * suggestions from their own notes instead.
 */
import { create } from "zustand";
import { AI_ENDPOINT, getAccessToken, supabaseConfigured } from "../supabase";
import { fromIndentedText } from "../io";
import type { OutlineItem } from "../tree";

/** Input limits in characters (the server enforces the same). Keeps AI token use low. */
export const AI_LIMITS = { prompt: 500, source: 6000, custom: 200 };

export type AIStatus = "idle" | "loading" | "ok" | "rate-limited" | "offline" | "unavailable" | "error";

interface AIState {
  status: AIStatus;
  /** True when a user is signed in (AI needs a session). */
  signedIn: boolean;
  set: (s: AIStatus) => void;
  setSignedIn: (v: boolean) => void;
}

export const useAIStatus = create<AIState>((set) => ({
  status: supabaseConfigured ? "idle" : "unavailable",
  signedIn: false,
  set: (status) => set({ status }),
  setSignedIn: (signedIn) => set({ signedIn }),
}));

/** AI can be offered at all on this deployment (sign-in is configured). */
export const aiConfigured = supabaseConfigured;
/** AI is usable right now (configured and signed in). */
export const aiAvailable = () => supabaseConfigured && useAIStatus.getState().signedIn;
/** Reactive version for components. */
export const useAIAvailable = () => useAIStatus((s) => supabaseConfigured && s.signedIn);

// --- Client-side rate limiting (the server enforces its own limit too) -------
const SUGGEST_PER_MIN = 12;
let suggestTimes: number[] = [];
/** Typeahead backs off after a 429; bigger generations never wait on it. */
let suggestCooldownUntil = 0;

function allowSuggest(now = Date.now()) {
  if (now < suggestCooldownUntil) return false;
  suggestTimes = suggestTimes.filter((t) => now - t < 60_000);
  if (suggestTimes.length >= SUGGEST_PER_MIN) return false;
  suggestTimes.push(now);
  return true;
}

export class AIError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

function handleError(e: unknown, kind: "suggest" | "generate" = "generate"): never {
  const status = (e as AIError)?.status ?? 0;
  if (status === 429) {
    if (kind === "suggest") suggestCooldownUntil = Date.now() + 30_000;
    useAIStatus.getState().set("rate-limited");
  } else if (typeof navigator !== "undefined" && !navigator.onLine) {
    useAIStatus.getState().set("offline");
  } else {
    useAIStatus.getState().set("error");
  }
  throw e;
}

/** POST a task to the AI function. */
async function callAI<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new AIError("Sign in to use AI", 401);
  const res = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    const detail = (data as { detail?: string }).detail;
    if (detail) console.warn("[noodl AI]", res.status, detail);
    throw new AIError(data.error || `AI request failed (${res.status})`, res.status);
  }
  return data;
}

// --- Typeahead suggestions ---------------------------------------------------
export interface SuggestContext {
  /** Root → parent texts. */
  path: string[];
  siblings: string[];
  /** What the user has typed so far (may be empty for "ideas" mode). */
  text: string;
}

const cache = new Map<string, string[]>();
const CACHE_MAX = 300;
const cacheKey = (c: SuggestContext) => JSON.stringify([c.path.slice(-4), c.siblings.slice(0, 8), c.text]);

export function cachedSuggestions(c: SuggestContext) {
  return cache.get(cacheKey(c));
}

export async function suggest(c: SuggestContext, signal?: AbortSignal): Promise<string[]> {
  const key = cacheKey(c);
  const hit = cache.get(key);
  if (hit) return hit;
  if (!allowSuggest()) {
    useAIStatus.getState().set("rate-limited");
    throw new Error("rate-limited");
  }
  useAIStatus.getState().set("loading");
  try {
    const res = await callAI<{ suggestions?: unknown }>({ task: "suggest", path: c.path.slice(-4), siblings: c.siblings.slice(0, 8), text: c.text.slice(0, 150) }, signal);
    const parsed = res;
    const list = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter((s): s is string => typeof s === "string" && !!s.trim()).map((s) => s.trim())
      : [];
    const clean = [...new Set(list)].filter((s) => s.toLowerCase() !== c.text.trim().toLowerCase()).slice(0, 5);
    cache.set(key, clean);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
    useAIStatus.getState().set("ok");
    return clean;
  } catch (e) {
    if ((e as Error)?.name === "AbortError" || signal?.aborted) {
      useAIStatus.getState().set("idle");
      throw e;
    }
    handleError(e, "suggest");
  }
}

// --- Bigger generations (prompts are built on the server) ----------------------
async function generateText(body: Record<string, unknown>): Promise<string> {
  useAIStatus.getState().set("loading");
  try {
    const res = await callAI<{ text?: string }>(body);
    useAIStatus.getState().set("ok");
    return res.text ?? "";
  } catch (e) {
    handleError(e);
  }
}

function parseOutline(raw: string, fallbackTitle: string): OutlineItem {
  const cleaned = raw.replace(/```[a-z]*\n?|```/g, "");
  const items = fromIndentedText(cleaned);
  if (items.length === 1) return items[0];
  return { text: fallbackTitle, children: items };
}

export async function generateMap(prompt: string, depth = 3): Promise<OutlineItem> {
  const raw = await generateText({ task: "generate", prompt: prompt.slice(0, AI_LIMITS.prompt), depth });
  return parseOutline(raw, prompt.slice(0, 60));
}

export async function summarizeToMap(source: string): Promise<OutlineItem> {
  const raw = await generateText({ task: "summarize", source: source.slice(0, AI_LIMITS.source) });
  return parseOutline(raw, "Summary");
}

export async function expandNode(path: string[], text: string, children: string[]): Promise<OutlineItem[]> {
  const raw = await generateText({ task: "expand", path: path.slice(-4), text, children: children.slice(0, 12) });
  return fromIndentedText(raw.replace(/```[a-z]*\n?|```/g, ""));
}

export type RewriteMode = "shorter" | "expand" | "grammar" | "clearer" | "question" | "custom";

export async function rewriteNode(text: string, mode: RewriteMode, path: string[], custom?: string): Promise<string> {
  const raw = await generateText({ task: "rewrite", text, mode, path: path.slice(-4), custom: custom?.slice(0, AI_LIMITS.custom) });
  return raw.trim().replace(/^["'“]|["'”]$/g, "").replace(/^[-*•]\s+/, "");
}
