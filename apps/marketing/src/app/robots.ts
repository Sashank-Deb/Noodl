import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

// Required for metadata routes with `output: "export"`.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The web app is a client-side tool with per-user content; keep it out of the index.
        disallow: "/app/",
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
