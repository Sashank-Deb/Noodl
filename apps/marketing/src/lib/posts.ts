export interface PostMeta {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO yyyy-mm-dd
  readingMinutes: number;
}

/** Newest first. Each post lives at src/app/blog/<slug>/page.tsx. */
export const POSTS: PostMeta[] = [
  {
    slug: "how-ai-typeahead-works",
    title: "How AI typeahead works in MindNote Web, and what it sends",
    description:
      "Ghost text, the Tab key, caching and the offline fallback: a plain explanation of how suggestions are made and exactly which text goes to Google Gemini.",
    date: "2026-10-19",
    readingMinutes: 6,
  },
  {
    slug: "outline-or-mind-map",
    title: "Outline or mind map? Use both",
    description:
      "Outlines are fast to write and mind maps are easy to read. Why MindNote Web treats them as two views of one note, and a simple routine for switching between them.",
    date: "2026-10-12",
    readingMinutes: 5,
  },
];

export const postPath = (slug: string) => `/blog/${slug}/`;

export function getPost(slug: string): PostMeta {
  const p = POSTS.find((x) => x.slug === slug);
  if (!p) throw new Error(`Unknown post: ${slug}`);
  return p;
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${d} ${months[m - 1]} ${y}`;
}
