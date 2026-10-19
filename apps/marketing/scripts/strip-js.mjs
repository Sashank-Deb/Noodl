// Post-export step: remove the Next.js client runtime from every exported HTML page.
//
// Every page on this site is a React Server Component with no client
// components, so the HTML is complete without hydration. The only things the
// runtime would add are client-side navigation and link prefetching, which a
// small static site does not need (plain <a> links load fast from the CDN).
// Removing it takes the JS shipped per page from ~150 KB to 0 KB.
//
// Kept: <script type="application/ld+json"> (structured data).
// Removed: <script src>, inline bootstrap/RSC-payload scripts,
//          <link rel="preload|modulepreload" as="script">, and the RSC
//          payload files (*.txt) that only the client router fetches.
//
// Opt out with KEEP_NEXT_JS=1 (e.g. to debug hydration).
import { readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.KEEP_NEXT_JS === "1") {
  console.log("strip-js: KEEP_NEXT_JS=1, leaving the Next.js runtime in place.");
  process.exit(0);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "out");

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      walk(p, files);
    } else {
      files.push(p);
    }
  }
  return files;
}

const files = walk(outDir);
let pages = 0;
let removedBytes = 0;

for (const file of files) {
  if (file.endsWith(".html")) {
    const before = readFileSync(file, "utf8");
    let html = before.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (all, attrs) =>
      /type=["']application\/ld\+json["']/i.test(attrs) ? all : "",
    );
    html = html.replace(/<link\b[^>]*\brel=["'](?:modulepreload|preload)["'][^>]*\bas=["']script["'][^>]*\/?>/gi, "");
    html = html.replace(/<link\b[^>]*\bas=["']script["'][^>]*\brel=["'](?:modulepreload|preload)["'][^>]*\/?>/gi, "");
    // Hidden "nojs" marker element that only the client router uses.
    html = html.replace(/<div hidden="">\s*<!--\$-->\s*<!--\/\$-->\s*<\/div>/g, "");
    if (/<script\b(?![^>]*application\/ld\+json)/i.test(html)) {
      console.error("strip-js: a script survived in", relative(outDir, file));
      process.exit(1);
    }
    removedBytes += before.length - html.length;
    writeFileSync(file, html);
    pages++;
  } else if (file.endsWith(".txt") && !file.endsWith("robots.txt")) {
    // RSC payloads for client navigation (index.txt, __next.*.txt).
    unlinkSync(file);
  }
}

// The client chunks are now unreferenced; delete them so they are never deployed.
for (const file of walk(join(outDir, "_next"))) {
  if (file.endsWith(".js")) unlinkSync(file);
}

console.log(
  `strip-js: removed the client runtime from ${pages} pages (${Math.round(removedBytes / 1024)} KB of inline markup).`,
);
