#!/usr/bin/env node
// Zero-dependency local server that mirrors the Vercel deployment:
//   /            marketing site (dist/)
//   /app/...     web app, falls back to /app/index.html
//   /api/ai      the AI function (api/_lib/ai-core.js), env from .env.local
// Usage: node scripts/serve-dist.mjs [dist] [--api-only]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const apiOnly = args.includes("--api-only");
const root = resolve(args.find((a) => !a.startsWith("--")) ?? join(repo, "dist"));
const port = Number(process.env.PORT ?? 4320);

// Minimal .env loader (repo-root .env.local, then .env); real env wins.
for (const f of [".env.local", ".env"]) {
  const p = join(repo, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const { handleAI } = await import(join(repo, "api/_lib/ai-core.js"));

const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".webp": "image/webp",
  ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".webmanifest": "application/manifest+json",
};

async function file(p) {
  try {
    const s = await stat(p);
    if (s.isDirectory()) return file(join(p, "index.html"));
    return p;
  } catch {
    return null;
  }
}

async function api(req, res) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const request = new Request(`http://localhost:${port}${req.url}`, {
    method: req.method,
    headers: Object.entries(req.headers).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])),
    body: ["GET", "HEAD", "OPTIONS"].includes(req.method ?? "") ? undefined : body,
  });
  const out = await handleAI(request, process.env);
  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/api/ai" || url.pathname === "/api/ai/") return api(req, res).catch((e) => res.writeHead(500).end(String(e)));
  if (apiOnly) return res.writeHead(404).end("API only");
  const safe = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let p = await file(join(root, safe));
  if (!p && !extname(safe)) p = await file(join(root, safe + ".html"));
  let status = 200;
  if (!p && safe.startsWith("/app/")) p = join(root, "app/index.html");
  if (!p) {
    status = 404;
    p = join(root, "404.html");
  }
  try {
    const body = await readFile(p);
    res.writeHead(status, {
      "content-type": types[extname(p)] ?? "application/octet-stream",
      "cache-control": p.includes("/_next/static/") ? "public, max-age=31536000, immutable" : "no-cache",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, () => {
  const ai = process.env.GEMINI_API_KEY ? "on" : "off (set GEMINI_API_KEY in .env.local)";
  console.log(
    apiOnly
      ? `\n  noodl AI function → http://localhost:${port}/api/ai (AI ${ai})\n`
      : `\n  noodl is running:\n    Marketing site → http://localhost:${port}/\n    Web app        → http://localhost:${port}/app/\n    AI function    → /api/ai (${ai})\n\n  Press Ctrl+C to stop.\n`,
  );
});
