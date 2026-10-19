import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MindNote Web",
    short_name: "MindNote",
    description: "Mind maps and outline notes with AI suggestions. Works offline.",
    start_url: "/app/",
    scope: "/app/",
    display: "standalone",
    background_color: "#fbfcfd",
    theme_color: "#2f4fd6",
    icons: [{ src: "/app/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
