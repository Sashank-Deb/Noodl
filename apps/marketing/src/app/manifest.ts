import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

// Required for metadata routes with `output: "export"`.
export const dynamic = "force-static";

// Marketing-site manifest. The installable PWA is the web app under /app/,
// which ships its own manifest; this one only describes the site and its icons.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "noodl",
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "browser",
    background_color: "#fffdf7",
    theme_color: "#151515",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { src: "/icon-512.png", type: "image/png", sizes: "512x512" },
      { src: "/icon-maskable-512.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
