import type { NextConfig } from "next";

/**
 * Static export: the app is plain HTML/JS/CSS served from Vercel's
 * CDN under /app — no server, no functions, $0 to host.
 */
const nextConfig: NextConfig = {
  output: "export",
  basePath: "/app",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
