import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static, pre-rendered HTML for Vercel (served at the domain root;
  // the web app lives under /app/ on the same domain).
  output: "export",
  trailingSlash: true,
  // No runtime image optimizer exists on a static host. We only ship SVG and
  // build-time generated PNGs (OG images / icons), so nothing needs optimising.
  images: { unoptimized: true },
  reactStrictMode: true,
  // cacheComponents / partialPrefetching (scaffold defaults) are intentionally off:
  // with `output: "export"`, metadata image routes (opengraph-image, apple-icon)
  // must declare `dynamic = "force-static"`, which Cache Components rejects. Partial
  // prefetching is a client-router feature, and this site ships no client router
  // (see scripts/postexport.mjs), so neither would do anything here.
  turbopack: {
    // pnpm monorepo: let Turbopack resolve hoisted packages from the workspace root.
    root: path.join(__dirname, "..", ".."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
