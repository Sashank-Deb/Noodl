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
 *    free Gemini quota; Gemini's own 429s are passed through.
 *
 * Env: GEMINI_API_KEY (required), GEMINI_MODEL (default gemini-3.1-flash-lite),
 *      NEXT_PUBLIC_Noodl_NOODLSUPABASE_URL + NEXT_PUBLIC_Noodl_NOODLSUPABASE_PUBLISHABLE_KEY
 *      (older SUPABASE_* / NEXT_PUBLIC_SUPABASE_* names also accepted),
 *      AI_ALLOWED_ORIGINS (optional, comma-separated, for cross-origin local dev).
 */

const SYSTEM =
  "You help people build mind maps and outline notes. Nodes are short (usually 1-8 words), concrete and specific. " +
  "Never add numbering, bullets, quotes or emoji unless the user did. Reply in the same language as the user's text.";

const OUTLINE_FORMAT =
  'Output ONLY an indented Markdown bullet list using "- " and two spaces per level. The first line is the central topic ' +
  "(no indentation). No headings, no prose, no code fences.";

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

/** Builds the Gemini request for a task. Exported for tests. */
export function buildRequest(body) {
  const task = str(body?.task, 20);
  const path = strs(body?.path, 6, 300);
  const where = path.length ? path.map((p, i) => `${"  ".repeat(i)}- ${p}`).join("\n") : "(this is the central topic)";
  switch (task) {
    case "suggest": {
      const siblings = strs(body?.siblings, 12, 200);
      const text = str(body?.text, 300);
      const sib = siblings.length ? siblings.map((s) => `- ${s}`).join("\n") : "(none)";
      const prompt = text.trim()
        ? `Mind map branch (root first):\n${where}\n\nExisting sibling nodes:\n${sib}\n\nThe user is typing a new node and has written: "${text}"\nGive 4 suggestions for the full node text. Each suggestion MUST start with exactly "${text}" (same characters) and continue it naturally. Do not repeat siblings.\nReturn JSON {"suggestions": [...]}.`
        : `Mind map branch (root first):\n${where}\n\nExisting sibling nodes:\n${sib}\n\nSuggest 4 short ideas for a new node at this position that are different from the siblings.\nReturn JSON {"suggestions": [...]}.`;
      return {
        task,
        prompt,
        config: {
          temperature: 0.6,
          maxOutputTokens: 512,
          responseMimeType: "application/json",
          responseSchema: { type: "OBJECT", properties: { suggestions: { type: "ARRAY", items: { type: "STRING" } } } },
        },
      };
    }
    case "generate": {
      const prompt = str(body?.prompt, 2000).trim();
      const depth = Math.min(4, Math.max(2, Number(body?.depth) || 3));
      if (!prompt) return null;
      return {
        task,
        prompt: `Create a well-structured mind map about: ${prompt}\nUse ${depth} levels below the central topic, 3-7 branches per level where useful, concise node text.\n${OUTLINE_FORMAT}`,
        config: { temperature: 0.7, maxOutputTokens: 4096 },
      };
    }
    case "summarize": {
      const source = str(body?.source, 20000).trim();
      if (!source) return null;
      return {
        task,
        prompt: `Summarize the following content into a mind map that captures its structure and key points.\n${OUTLINE_FORMAT}\n\nCONTENT:\n${source}`,
        config: { temperature: 0.4, maxOutputTokens: 4096 },
      };
    }
    case "expand": {
      const text = str(body?.text, 300);
      const children = strs(body?.children, 20, 200);
      return {
        task,
        prompt: `Mind map branch: ${[...path, text].join(" > ")}\nExisting children: ${children.join("; ") || "none"}\nSuggest 3-6 new child nodes for "${text}" (one level, optionally one more level beneath each).\nOutput ONLY an indented Markdown bullet list ("- ", two spaces per level).`,
        config: { temperature: 0.7, maxOutputTokens: 1024 },
      };
    }
    case "rewrite": {
      const text = str(body?.text, 1000);
      const mode = str(body?.mode, 20);
      const instruction = mode === "custom" ? str(body?.custom, 300) || "Improve it." : REWRITE[mode];
      if (!text.trim() || !instruction) return null;
      return {
        task,
        prompt: `Context: ${path.join(" > ") || "(central topic)"}\nRewrite this mind map node. ${instruction}\nNode: ${text}\nReply with only the rewritten node text.`,
        config: { temperature: 0.5, maxOutputTokens: 256 },
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

// --- Gemini ------------------------------------------------------------------
async function callGemini(req, env, signal) {
  const model = env.GEMINI_MODEL || "gemini-3.1-flash-lite";
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
  if (!res.ok) {
    const status = res.status === 429 ? 429 : 502;
    throw Object.assign(new Error(status === 429 ? "AI is busy (free quota). Try again in a minute." : "Gemini didn't respond."), { status, detail: data?.error?.message });
  }
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => (p.thought ? "" : p.text ?? "")).join("");
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
  if (!env.GEMINI_API_KEY) return json(503, { error: "AI isn't configured on this deployment" }, h);
  if (Number(request.headers.get("content-length") || 0) > 100_000) return json(413, { error: "Request too large" }, h);

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Sign in to use AI" }, h);
  try {
    const uid = await verifyUser(token, env);
    if (!uid) return json(401, { error: "Your session has expired. Sign in again." }, h);

    const body = await request.json().catch(() => null);
    const req = buildRequest(body);
    if (!req) return json(400, { error: "Unsupported AI request" }, h);
    if (!rateLimit(uid, req.task)) return json(429, { error: "You're going fast! AI pauses for a minute." }, { ...h, "retry-after": "60" });

    const text = await callGemini(req, env, request.signal);
    if (req.task === "suggest") {
      let suggestions = [];
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed?.suggestions)) suggestions = parsed.suggestions.filter((s) => typeof s === "string").slice(0, 5);
      } catch {
        /* empty list */
      }
      return json(200, { suggestions }, h);
    }
    return json(200, { text }, h);
  } catch (e) {
    const status = /** @type {{status?: number}} */ (e).status ?? 500;
    if (status >= 500) console.error("ai error", e);
    return json(status, { error: /** @type {Error} */ (e).message || "AI request failed" }, h);
  }
}
