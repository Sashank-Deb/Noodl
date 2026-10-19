import type { MetadataRoute } from "next";
import { POSTS, postPath } from "@/lib/posts";
import { absoluteUrl } from "@/lib/site";

// Required for metadata routes with `output: "export"`.
export const dynamic = "force-static";

const PAGES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/features/", priority: 0.9, changeFrequency: "monthly" },
  { path: "/templates/", priority: 0.8, changeFrequency: "monthly" },
  { path: "/use-cases/", priority: 0.6, changeFrequency: "monthly" },
  { path: "/use-cases/students/", priority: 0.7, changeFrequency: "monthly" },
  { path: "/use-cases/meeting-notes/", priority: 0.7, changeFrequency: "monthly" },
  { path: "/use-cases/writers/", priority: 0.7, changeFrequency: "monthly" },
  { path: "/blog/", priority: 0.6, changeFrequency: "weekly" },
  { path: "/privacy/", priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...PAGES.map((p) => ({ url: absoluteUrl(p.path), changeFrequency: p.changeFrequency, priority: p.priority })),
    ...POSTS.map((p) => ({
      url: absoluteUrl(postPath(p.slug)),
      lastModified: p.date,
      changeFrequency: "yearly" as const,
      priority: 0.5,
    })),
  ];
}
