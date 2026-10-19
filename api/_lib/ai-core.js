// @ts-check
/**
 * noodl AI endpoint core (runs on Vercel Functions, and locally via
 * scripts/serve-dist.mjs). Zero dependencies.
 *
 *  - Only signed-in users: the Supabase access token is verified against
 *    Supabase Auth (cached briefly), so the Gemini key can't be used anonymously.
 *  - Prompts are built here from structured input; the endpoint is not a
 *    general-purpose Gemini proxy.
 *  - Per-user rate limits (best effort, per function instance) protect the
 *    free provider quotas.
 *  - Providers: Groq first (OpenAI-compatible API), Gemini as automatic backup.
 *    If one is rate-limited or fails, the next one is tried.
 *
 * Env: GROQ_API_KEY and/or GEMINI_API_KEY (at least one),
 *      GROQ_MODEL (default openai/gpt-oss-20b), GROQ_FAST_MODEL (typeahead,
 *      default llama-3.1-8b-instant), GROQ_BASE_URL (tests),
 *      GEMINI_MODEL (default gemini-flash-lite-latest), GEMINI_BASE_URL (tests),
 *      NEXT_PUBLIC_Noodl_NOODLSUPABASE_URL + NEXT_PUBLIC_Noodl_NOODLSUPABASE_PUBLISHABLE_KEY
 *      (older SUPABASE_* / NEXT_PUBLIC_SUPABASE_* names also accepted),
 *      AI_ALLOWED_ORIGINS (optional, comma-separated, for cross-origin local dev).
 */

// Kept short: it's sent with every request.
const SYSTEM = "You write mind map nodes: 1-8 words, concrete. No numbering, quotes or emoji. Reply in the user's language.";

const OUTLINE_FORMAT = 'Output ONLY a Markdown bullet list ("- ", 2 spaces per level), first line = central topic. No prose.';

/** Input caps (characters). The app enforces the same limits in its text boxes. */
export const MAX = { prompt: 500, source: 6000, node: 150, custom: 200 };

const REWRITE = {
  shorter: "Make it shorter and punchier.",
  expand: "Make it a bit more specific and descriptive (max ~15 words).",
  grammar: "Fix grammar and spelling only.",
  clearer: "Make it clearer.",
  question: "Turn it into a short question that this node answers or raises.",
};

const LIMITS = { suggest: { perMin: 30 }, other: { perMin: 10 }, perDay: 600 };

/** @param {unknown} v @param {number} max */
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
/** @param {unknown} v @param {number} n @param {number} max */
const strs = (v, n, max) => (Array.isArray(v) ? v.slice(0, n).map((x) => str(x, max)).filter(Boolean) : []);

/** Builds the model request for a task. Exported for tests. */
export function buildRequest(body) {
  const task = str(body?.task, 20);
  const path = strs(body?.path, 4, MAX.node);
  const where = path.length ? path.map((p, i) => `${"  ".repeat(i)}- ${p}`).join("\n") : "(this is the central topic)";
  switch (task) {
    case "suggest": {
      const siblings = strs(body?.siblings, 8, 80);
      const text = str(body?.text, MAX.node);
      const sib = siblings.length ? siblings.map((s) => `- ${s}`).join("\n") : "(none)";
      const prompt = text.trim()
        ? `Branch:\n${where}\nSiblings:\n${sib}\nComplete the new node "${text}": 4 options, each starting with exactly "${text}", not repeating siblings. JSON {"suggestions":[...]}`
        : `Branch:\n${where}\nSiblings:\n${sib}\n4 new node ideas here, unlike the siblings. JSON {"suggestions":[...]}`;
      return {
        task,
        prompt,
        config: {
          temperature: 0.6,
          maxOutputTokens: 120,
          responseMimeType: "application/json",
          responseSchema: { type: "OBJECT", properties: { suggestions: { type: "ARRAY", items: { type: "STRING" } } } },
        },
      };
    }
    case "generate": {
      const prompt = str(body?.prompt, MAX.prompt).trim();
      const depth = Math.min(4, Math.max(2, Number(body?.depth) || 3));
      if (!prompt) return null;
      return {
        task,
        prompt: `Mind map about: ${prompt}\n${depth} levels below the topic, 3-5 branches each, at most ${depth >= 4 ? 60 : 40} nodes.\n${OUTLINE_FORMAT}`,
        config: { temperature: 0.7, maxOutputTokens: depth >= 4 ? 1000 : 700 },
      };
    }
    case "summarize": {
      const source = str(body?.source, MAX.source).trim();
      if (!source) return null;
      return {
        task,
        prompt: `Summarize as a mind map of the key points (max 40 nodes).\n${OUTLINE_FORMAT}\nCONTENT:\n${source}`,
        config: { temperature: 0.4, maxOutputTokens: 700 },
      };
    }
    case "expand": {
      const text = str(body?.text, MAX.node);
      const children = strs(body?.children, 12, 80);
      return {
        task,
        prompt: `Branch: ${[...path, text].join(" > ")}\nExisting children: ${children.join("; ") || "none"}\n3-6 new child nodes for "${text}", optionally one level deeper. Output ONLY a Markdown bullet list ("- ", 2 spaces per level).`,
        config: { temperature: 0.7, maxOutputTokens: 300 },
      };
    }
    case "rewrite": {
      const text = str(body?.text, MAX.node * 2);
      const mode = str(body?.mode, 20);
      const instruction = mode === "custom" ? str(body?.custom, MAX.custom) || "Improve it." : REWRITE[mode];
      if (!text.trim() || !instruction) return null;
      return {
        task,
        prompt: `Context: ${path.join(" > ") || "(central topic)"}\nRewrite this node. ${instruction}\nNode: ${text}\nReply with only the new text.`,
        config: { temperature: 0.5, maxOutputTokens: 100 },
      };
    }
    default:
      return null;
  }
}

// --- auth -------------------------------------------------------------------
/** @type {Map<string, { uid: string; until: number }>} */
const tokenCache = new Map();

async function verifyUser(token, env) {
  const hit = tokenCache.get(token);
  const now = Date.now();
  if (hit && hit.until > now) return hit.uid;
  const url = env.NEXT_PUBLIC_Noodl_NOODLSUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    env.NEXT_PUBLIC_Noodl_NOODLSUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw Object.assign(new Error("Sign-in is not configured on the server"), { status: 500 });
  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, { headers: { apikey: key, authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null);
  if (!user?.id) return null;
  tokenCache.set(token, { uid: user.id, until: now + 60_000 });
  if (tokenCache.size > 5000) tokenCache.delete(tokenCache.keys().next().value);
  return user.id;
}

// --- rate limiting (best effort, per instance) -------------------------------
/** @type {Map<string, number[]>} */
const hits = new Map();
/** @type {Map<string, { day: string; n: number }>} */
const daily = new Map();

export function rateLimit(uid, task, now = Date.now()) {
  const kind = task === "suggest" ? "suggest" : "other";
  const k = `${uid}:${kind}`;
  const list = (hits.get(k) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= LIMITS[kind].perMin) return false;
  const day = new Date(now).toISOString().slice(0, 10);
  const d = daily.get(uid);
  const count = d && d.day === day ? d.n : 0;
  if (count >= LIMITS.perDay) return false;
  list.push(now);
  hits.set(k, list);
  daily.set(uid, { day, n: count + 1 });
  return true;
}

// --- providers ----------------------------------------------------------------
/** @param {number} status @param {string} name @param {unknown} data */
function upstreamError(status, name, data) {
  const d = /** @type {any} */ (data);
  const detail = String(d?.error?.message ?? `HTTP ${status}`).slice(0, 500);
  console.warn(`${name} error`, status, detail);
  const s = status === 429 ? 429 : 502;
  return Object.assign(
    new Error(s === 429 ? "AI is busy right now (free quota). Try again in a minute." : "AI didn't respond. Try again."),
    { status: s, detail: `${name}: ${detail}` },
  );
}

async function callGroq(req, env, signal) {
  const base = env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
  const model =
    req.task === "suggest"
      ? env.GROQ_FAST_MODEL || "llama-3.1-8b-instant"
      : env.GROQ_MODEL || "openai/gpt-oss-20b";
  const c = req.config;
  /** @type {Record<string, unknown>} */
  const body = {
    model,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: req.prompt },
    ],
    temperature: c.temperature,
    max_completion_tokens: c.maxOutputTokens,
  };
  if (c.responseMimeType === "application/json") body.response_format = { type: "json_object" };
  // gpt-oss models think first; keep that short and leave room for the answer.
  if (/gpt-oss/.test(model))
    Object.assign(body, { reasoning_effort: "low", include_reasoning: false, max_completion_tokens: c.maxOutputTokens + 300 });
  const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw upstreamError(res.status, "groq", data);
  return String(data?.choices?.[0]?.message?.content ?? "");
}

async function callGemini(req, env, signal) {
  const model = env.GEMINI_MODEL || "gemini-flash-lite-latest";
  const base = env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com";
  const res = await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: req.prompt }] }],
      generationConfig: req.config,
    }),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw upstreamError(res.status, "gemini", data);
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => (p.thought ? "" : p.text ?? "")).join("");
}

/** Providers configured on this deployment, in order of preference. */
const providers = (env) => [
  ...(env.GROQ_API_KEY ? [callGroq] : []),
  ...(env.GEMINI_API_KEY ? [callGemini] : []),
];

/** Tries each provider in turn; returns the first answer. */
async function callModel(req, env, signal) {
  let last;
  for (const call of providers(env)) {
    try {
      return await call(req, env, signal);
    } catch (e) {
      if (signal?.aborted) throw e;
      last = e;
    }
  }
  throw last ?? Object.assign(new Error("AI isn't configured on this deployment"), { status: 503 });
}

// --- handler -----------------------------------------------------------------
function cors(request, env) {
  const origin = request.headers.get("origin");
  const allowed = (env.AI_ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "600",
    vary: "origin",
  };
}

const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...extra } });

/**
 * @param {Request} request
 * @param {Record<string, string | undefined>} env
 */
export async function handleAI(request, env) {
  const h = cors(request, env);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" }, h);
  if (!providers(env).length) return json(503, { error: "AI isn't configured on this deployment" }, h);
  if (Number(request.headers.get("content-length") || 0) > 20_000) return json(413, { error: "Request too large" }, h);

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Sign in to use AI" }, h);
  try {
    const uid = await verifyUser(token, env);
    if (!uid) return json(401, { error: "Your session has expired. Sign in again." }, h);

    const body = await request.json().catch(() => null);
    const req = buildRequest(body);
    if (!req) return json(400, { error: "Unsupported AI request" }, h);
    if (!rateLimit(uid, req.task)) return json(429, { error: "You're going fast! AI pauses for a minute." }, { ...h, "retry-after": "60" });

    const text = await callModel(req, env, request.signal);
    if (req.task === "suggest") {
      let suggestions = [];
      try {
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : parsed?.suggestions;
        if (Array.isArray(list)) suggestions = list.filter((s) => typeof s === "string").slice(0, 5);
      } catch {
        /* empty list */
      }
      return json(200, { suggestions }, h);
    }
    return json(200, { text }, h);
  } catch (e) {
    const status = /** @type {{status?: number}} */ (e).status ?? 500;
    if (status >= 500) console.error("ai error", e);
    const detail = /** @type {{detail?: string}} */ (e).detail;
    return json(status, { error: /** @type {Error} */ (e).message || "AI request failed", ...(detail ? { detail } : {}) }, h);
  }
}
