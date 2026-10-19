#!/usr/bin/env node
// Zero-dependency static server for dist/ (marketing at /, app at /app/).
// Mirrors firebase.json: /app/** falls back to /app/index.html, 404.html otherwise.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "dist");
const port = Number(process.env.PORT ?? 4320);
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

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
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
  console.log(`\n  noodl is running:\n    Marketing site → http://localhost:${port}/\n    Web app        → http://localhost:${port}/app/\n\n  Press Ctrl+C to stop.\n`);
});
