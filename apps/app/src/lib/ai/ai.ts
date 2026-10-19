/**
 * Gemini via Firebase AI Logic. The browser calls Gemini directly; the API key
 * never leaves Google's side and App Check stops abuse, so there's no proxy
 * server to run or pay for. Works on the free Spark plan (Gemini Developer API
 * free tier). Every call degrades gracefully: callers fall back to local
 * suggestions when AI is off, offline, unconfigured or rate-limited.
 */
import { create } from "zustand";
import { firebaseConfigured, getFirebaseApp, GEMINI_MODEL } from "../firebase";
import { fromIndentedText, } from "../io";
import type { OutlineItem } from "../tree";
import type { GenerativeModel } from "firebase/ai";

export type AIStatus = "idle" | "loading" | "ok" | "rate-limited" | "offline" | "unavailable" | "error";

export const useAIStatus = create<{ status: AIStatus; set: (s: AIStatus) => void }>((set) => ({
  status: firebaseConfigured ? "idle" : "unavailable",
  set: (status) => set({ status }),
}));

export const aiAvailable = () => firebaseConfigured;

// --- Client-side rate limiting (protects the shared free quota) -------------
const SUGGEST_PER_MIN = 12;
let suggestTimes: number[] = [];
let cooldownUntil = 0;

function allowSuggest(now = Date.now()) {
  if (now < cooldownUntil) return false;
  suggestTimes = suggestTimes.filter((t) => now - t < 60_000);
  if (suggestTimes.length >= SUGGEST_PER_MIN) return false;
  suggestTimes.push(now);
  return true;
}

function handleError(e: unknown): never {
  const msg = String((e as Error)?.message ?? e);
  if (/429|quota|rate|RESOURCE_EXHAUSTED/i.test(msg)) {
    cooldownUntil = Date.now() + 60_000;
    useAIStatus.getState().set("rate-limited");
  } else if (typeof navigator !== "undefined" && !navigator.onLine) {
    useAIStatus.getState().set("offline");
  } else {
    useAIStatus.getState().set("error");
  }
  throw e;
}

// --- Model handles (lazy) ----------------------------------------------------
let jsonModel: Promise<GenerativeModel> | null = null;
let textModel: Promise<GenerativeModel> | null = null;

const SYSTEM = `You help people build mind maps and outline notes. Nodes are short (usually 1-8 words), concrete and specific. Never add numbering, bullets, quotes or emoji unless the user did. Reply in the same language as the user's text.`;

async function getModels() {
  if (!firebaseConfigured) throw new Error("AI unavailable");
  if (!jsonModel || !textModel) {
    const app = await getFirebaseApp();
    const { getAI, getGenerativeModel, GoogleAIBackend, Schema } = await import("firebase/ai");
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    jsonModel = Promise.resolve(
      getGenerativeModel(ai, {
        model: GEMINI_MODEL,
        systemInstruction: SYSTEM,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: Schema.object({
            properties: { suggestions: Schema.array({ items: Schema.string() }) },
          }),
          temperature: 0.6,
          maxOutputTokens: 200,
        },
      }),
    );
    textModel = Promise.resolve(
      getGenerativeModel(ai, {
        model: GEMINI_MODEL,
        systemInstruction: SYSTEM,
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    );
  }
  return { json: await jsonModel!, text: await textModel! };
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
const cacheKey = (c: SuggestContext) => JSON.stringify([c.path.slice(-4), c.siblings.slice(0, 12), c.text]);

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
  const { json } = await getModels();
  const where = c.path.length ? c.path.map((p, i) => `${"  ".repeat(i)}- ${p}`).join("\n") : "(this is the central topic)";
  const sib = c.siblings.length ? c.siblings.map((s) => `- ${s}`).join("\n") : "(none)";
  const prompt = c.text.trim()
    ? `Mind map branch (root first):\n${where}\n\nExisting sibling nodes:\n${sib}\n\nThe user is typing a new node and has written: "${c.text}"\nGive 4 suggestions for the full node text. Each suggestion MUST start with exactly "${c.text}" (same characters) and continue it naturally. Do not repeat siblings.\nReturn JSON {"suggestions": [...]}.`
    : `Mind map branch (root first):\n${where}\n\nExisting sibling nodes:\n${sib}\n\nSuggest 4 short ideas for a new node at this position that are different from the siblings.\nReturn JSON {"suggestions": [...]}.`;
  useAIStatus.getState().set("loading");
  try {
    const res = await json.generateContent(prompt, { signal });
    const parsed = JSON.parse(res.response.text()) as { suggestions?: unknown };
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
    handleError(e);
  }
}

// --- Bigger generations --------------------------------------------------------
async function generateText(prompt: string): Promise<string> {
  if (Date.now() < cooldownUntil) {
    useAIStatus.getState().set("rate-limited");
    throw new Error("AI is rate-limited. Try again in a minute.");
  }
  const { text } = await getModels();
  useAIStatus.getState().set("loading");
  try {
    const res = await text.generateContent(prompt);
    useAIStatus.getState().set("ok");
    return res.response.text();
  } catch (e) {
    handleError(e);
  }
}

const OUTLINE_FORMAT = `Output ONLY an indented Markdown bullet list using "- " and two spaces per level. The first line is the central topic (no indentation). No headings, no prose, no code fences.`;

function parseOutline(raw: string, fallbackTitle: string): OutlineItem {
  const cleaned = raw.replace(/```[a-z]*\n?|```/g, "");
  const items = fromIndentedText(cleaned);
  if (items.length === 1) return items[0];
  return { text: fallbackTitle, children: items };
}

export async function generateMap(prompt: string, depth = 3): Promise<OutlineItem> {
  const raw = await generateText(
    `Create a well-structured mind map about: ${prompt}\nUse ${depth} levels below the central topic, 3-7 branches per level where useful, concise node text.\n${OUTLINE_FORMAT}`,
  );
  return parseOutline(raw, prompt.slice(0, 60));
}

export async function summarizeToMap(source: string): Promise<OutlineItem> {
  const raw = await generateText(
    `Summarize the following content into a mind map that captures its structure and key points.\n${OUTLINE_FORMAT}\n\nCONTENT:\n${source.slice(0, 30_000)}`,
  );
  return parseOutline(raw, "Summary");
}

export async function expandNode(path: string[], text: string, siblings: string[]): Promise<OutlineItem[]> {
  const raw = await generateText(
    `Mind map branch: ${[...path, text].join(" > ")}\nExisting children: ${siblings.join("; ") || "none"}\nSuggest 3-6 new child nodes for "${text}" (one level, optionally one more level beneath each).\nOutput ONLY an indented Markdown bullet list ("- ", two spaces per level).`,
  );
  return fromIndentedText(raw.replace(/```[a-z]*\n?|```/g, ""));
}

export type RewriteMode = "shorter" | "expand" | "grammar" | "clearer" | "custom";

export async function rewriteNode(text: string, mode: RewriteMode, path: string[], custom?: string): Promise<string> {
  const instruction = {
    shorter: "Make it shorter and punchier.",
    expand: "Make it a bit more specific and descriptive (max ~15 words).",
    grammar: "Fix grammar and spelling only.",
    clearer: "Make it clearer.",
    custom: custom || "Improve it.",
  }[mode];
  const raw = await generateText(
    `Context: ${path.join(" > ") || "(central topic)"}\nRewrite this mind map node. ${instruction}\nNode: ${text}\nReply with only the rewritten node text.`,
  );
  return raw.trim().replace(/^["'“]|["'”]$/g, "").replace(/^[-*•]\s+/, "");
}
