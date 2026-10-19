/**
 * Single source of truth for URLs, app deep links and shared copy.
 * Every CTA on the site must link through APP_LINKS so the /app/ contract
 * with the web app stays in one place.
 */

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://noodl.vercel.app"
).replace(/\/+$/, "");

export const SITE_NAME = "noodl";

export const SITE_DESCRIPTION =
  "A free, local-first outliner and mind map in your browser. Write a list, flip it into a map, and let suggestions follow what your map is about. Works offline, no account needed.";

export const TEMPLATE_IDS = [
  "blank",
  "project",
  "lecture",
  "meeting",
  "swot",
  "novel",
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/** Deep links into the web app, served from the same domain under /app/. */
export const APP_LINKS = {
  home: "/app/",
  newNote: "/app/?new=1",
  generate: "/app/?generate=1",
  template: (id: TemplateId) => `/app/?template=${id}`,
} as const;

/** Absolute URL for a site path ("/features/" -> "https://…/features/"). */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const NAV_LINKS = [
  { href: "/features/", label: "Features" },
  { href: "/templates/", label: "Templates" },
  { href: "/use-cases/", label: "Use cases" },
  { href: "/blog/", label: "Blog" },
  { href: "/privacy/", label: "Privacy" },
] as const;

export const USE_CASES = [
  {
    href: "/use-cases/students/",
    label: "Students",
    blurb: "Lecture notes you can revise as a map.",
  },
  {
    href: "/use-cases/meeting-notes/",
    label: "Meeting notes",
    blurb: "Agenda in, decisions and owners out.",
  },
  {
    href: "/use-cases/writers/",
    label: "Writers",
    blurb: "Plot, characters and scenes in one tree.",
  },
] as const;
