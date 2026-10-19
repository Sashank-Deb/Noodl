# noodl — marketing site (`apps/marketing`)

Static, pre-rendered marketing site for noodl. Next.js 16 App Router,
React Server Components only, Tailwind v4 + the shared `@noodl/tokens`.
It is exported to plain HTML (`output: "export"`, `trailingSlash: true`) and
deployed to Vercel at the domain root (see the root `vercel.json`); the web app is served from the
same domain under `/app/`.

**Zero client JavaScript.** No page contains a client component, so after
`next build` the `scripts/postexport.mjs` step removes the Next.js runtime
(~170 KB gzipped per page) from every HTML file. Navigation uses plain `<a>`
links; the mobile menu and FAQ are native `<details>`. JSON-LD scripts are kept.
Set `KEEP_NEXT_JS=1` to skip the strip (e.g. if you ever add a client component —
then also restore `next/link` and re-enable `@next/next/no-html-link-for-pages`).

## Commands

Run from the repo root (pnpm workspace):

| Command | What it does |
|---|---|
| `pnpm --filter marketing dev` | Dev server on http://localhost:3001 |
| `pnpm --filter marketing build` | Generate dark tokens → `next build` → `postexport` → `apps/marketing/out` |
| `pnpm --filter marketing build:keep-js` | Same, but keep the Next.js client runtime |
| `pnpm --filter marketing lint` | ESLint (next core-web-vitals + TS) |
| `pnpm --filter marketing serve` | Serve `out/` on http://localhost:4321 |
| `pnpm --filter marketing lhci` | Lighthouse CI against `out/` (`lighthouserc.json`, all categories ≥ 0.95). Needs `CHROME_PATH` if Chrome isn't on the PATH. |

## Environment

| Variable | Default | Used for |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://noodl.vercel.app` | `metadataBase`, canonical URLs, Open Graph URLs, `sitemap.xml`, `robots.txt`, JSON-LD |

Set it at build time for a custom domain, e.g. `NEXT_PUBLIC_SITE_URL=https://noodl.example pnpm --filter marketing build`.

## Pages

| Path | Notes |
|---|---|
| `/` | Hero (HTML/CSS/SVG product visual), proof points, how it works, outline↔map, AI typeahead, local-first band, templates teaser, FAQ (`FAQPage`), final CTA. `SoftwareApplication` JSON-LD. |
| `/features/` | Full feature list, AI tools, offline/sync, export formats table, keyboard shortcut tables. |
| `/templates/` | The six app templates with build-time SVG mini maps; "Use template" → `/app/?template=<id>`. |
| `/use-cases/` | Index of the three guides. |
| `/use-cases/students/`, `/use-cases/meeting-notes/`, `/use-cases/writers/` | Long-form guides (~600–800 words each). |
| `/privacy/` | Privacy notice — **marked "Draft — have this reviewed before launch"**, with two `[Reviewer: …]` placeholders (Gemini data-use terms, contact address). |
| `/blog/` + `/blog/outline-or-mind-map/`, `/blog/how-ai-typeahead-works/` | Posts are TSX pages; metadata lives in `src/lib/posts.ts`. |
| `404.html` | Custom not-found page (`noindex`). Vercel serves it automatically for unknown paths. |
| `sitemap.xml`, `robots.txt`, `manifest.webmanifest`, `icon.svg`, `apple-icon.png`, `icon-192/512.png`, `**/opengraph-image.png` | Generated at build time. |

All app deep links come from `APP_LINKS` in `src/lib/site.ts`:
`/app/`, `/app/?new=1`, `/app/?generate=1`, `/app/?template=<blank|project|lecture|meeting|swot|novel>`.

Adding a blog post: add an entry to `POSTS` in `src/lib/posts.ts`, create
`src/app/blog/<slug>/page.tsx` (use `PostLayout`) and an `opengraph-image.tsx`
next to it (copy an existing one). The sitemap and blog index pick it up.

## Design implementation

- Tokens: `@import "@noodl/tokens/tokens.css"` in `globals.css`. Dark mode
  follows `prefers-color-scheme` with no JS and no flash: `scripts/gen-dark-tokens.mjs`
  copies the `.dark { … }` block of tokens.css into
  `src/app/dark-tokens.generated.css` under a media query (runs before `dev`/`build`,
  so it never drifts). The privacy band uses the app's `.dark` class directly.
- Local token override: light `--ghost-text` is darkened from `oklch(0.58…)`
  (4.28:1 on white, below AA) to `oklch(0.56…)` (4.65:1). **Please fix in
  `@noodl/tokens`** and then delete the override in `globals.css`.
- Fonts (self-hosted via `next/font/local`, both preloaded, `display: swap`):
  - `src/fonts/onest-latin-wght.woff2` (34 KB) from `@fontsource-variable/onest`.
  - `src/fonts/bricolage-grotesque-display.woff2` (37 KB): Bricolage Grotesque
    from `@fontsource-variable/bricolage-grotesque` (latin, all axes, 131 KB)
    instanced to `wdth 92`, `opsz 96` (DESIGN.md §2), `wght 600–800` with fontTools:
    ```py
    from fontTools.ttLib import TTFont; from fontTools.varLib import instancer
    f = TTFont("…/bricolage-grotesque-latin-standard-normal.woff2")
    i = instancer.instantiateVariableFont(f, {"wdth": 92, "opsz": 96, "wght": (600, 800)})
    i.flavor = "woff2"; i.save("src/fonts/bricolage-grotesque-display.woff2")
    ```
  - OG images use static WOFF files from `@fontsource/onest` and
    `@fontsource/bricolage-grotesque` (Satori can't read WOFF2).
  - JetBrains Mono is not loaded; `<kbd>` falls back to the system monospace.
- `next.config.ts`: the scaffold's `cacheComponents`/`partialPrefetching` are
  off. With `output: "export"`, metadata routes need `dynamic = "force-static"`,
  which Cache Components rejects; partial prefetching is a client-router feature
  and there is no client router.

## SEO checklist

- [x] Metadata API on every page: unique title (template `%s · noodl`), description, canonical, Open Graph, Twitter `summary_large_image`.
- [x] Per-section generated OG images (`opengraph-image.tsx`, 1200×630 PNG), also used for `twitter:image`.
- [x] `sitemap.xml` (all indexable pages + posts), `robots.txt` (disallows `/app/`), `manifest.webmanifest`, SVG favicon, Apple touch icon, PNG icons.
- [x] JSON-LD: `Organization` + `WebSite` (every page), `SoftwareApplication` (home, features; free offer), `FAQPage` (home), `BreadcrumbList` (all nested pages), `BlogPosting` (posts), `Blog`, `ItemList` (templates).
- [x] One `h1` per page, semantic landmarks, skip link, `lang="en"`, descriptive link text.
- [x] No third-party requests, no analytics, no client JS.
- [ ] Before launch: set `NEXT_PUBLIC_SITE_URL` to the production domain, get the privacy notice reviewed, submit the sitemap in Search Console, validate with the Rich Results Test.

## Hosting headers

Caching and security headers live in the root `vercel.json`: immutable caching
for `/_next/static/**`, revalidation for HTML, HSTS, `nosniff`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy`, and a report-only CSP for `/app/**`.

## Verification (last run)

- `pnpm --filter marketing build` and `lint`: clean.
- Lighthouse 12, mobile, default throttling, local `python3 -m http.server`
  (no compression or cache headers): every page 99–100 performance and 100
  accessibility / best practices / SEO; CLS 0; 0 KB JS.
