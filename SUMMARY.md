# noodl — handoff summary

Read this first if you're picking up the project in a new session. It covers what noodl is, how the code is organised, the decisions behind it, how to run and verify it, and what's left to do.

Repo: https://github.com/Sashank-Deb/Noodl (branch `main`).

## 1. What it is

**noodl** ("Let your brain wander.") is a free, local-first mind-mapping web app. Its UX follows the iOS app *MindNote – Mind Map & Notes*: every note is a single tree of nodes that you can view either as an **outline** or as a **mind map**, and switch between instantly. Every node is a **typeahead input** with AI suggestions from Gemini. When AI is off, offline or rate-limited, it falls back to phrases from your own notes.

Product goals set by the owner:
- Next.js + shadcn/ui.
- Near-zero running cost. Everything stays on Google's free tiers and there is no backend of our own.
- **No GCP.** Hosting on Vercel, auth + sync on Supabase, AI via a Gemini API key (Google AI Studio) used only server-side in a Vercel Function. AI is for signed-in users only.
- Guest mode by default. Sign-in only adds cross-device sync.
- An SEO-first marketing site that scores high on Lighthouse.
- The design benchmarks Excalidraw's canvas feel, while the UX follows MindNote.

## 2. Repo layout

```
apps/app          The web app. Next.js 16 static export, basePath /app (served at /app/)
apps/marketing    The marketing site. Next.js 16 static export served at /. Ships 0 KB JS
packages/tokens   @noodl/tokens: shared shadcn/Tailwind v4 CSS variables (light + .dark), brand vars
packages/brand    noodl brand kit: logos, app icons, favicons, social preview, README with colours
design/           DESIGN.md (UX spec, source of truth), tokens.css, mockups.html (static frames)
scripts/build-site.sh   Builds both apps into dist/ (marketing at /, app at /app/)
scripts/serve-dist.mjs  Zero-dependency local server for dist/ + /api/ai (mirrors vercel.json routing)
tests/supabase-rls      RLS tests for supabase/migrations, on PGlite (in-process Postgres)
tests/api               Tests for the AI function (auth, validation, rate limits, errors)
Start/Dev noodl.command macOS double-click launchers; TESTING.md manual checklist
vercel.json       Build (scripts/build-site.sh → dist/), headers, CSP report-only, /app/* rewrite, function config
api/ai.js         Vercel Function entry; logic in api/_lib/ai-core.js (zero deps)
supabase/migrations  Postgres tables notes/folders, RLS (owner only), server timestamps, Realtime
.env.example      All env vars (repo root .env.local for local runs; same names in Vercel)
.github/workflows ci.yml (lint, all tests, build, LHCI). Deploys: Vercel GitHub integration
```

Package manager: **pnpm 10** workspaces. Node 22.

## 3. Architecture and key decisions

- **Static sites + one function on Vercel.** Both apps use `output: "export"`; `scripts/build-site.sh` assembles `dist/` (marketing at `/`, app at `/app/`). `api/ai.js` is the only server code.
  - Vercel's free Hobby plan is **non-commercial only**; a commercial launch needs Pro ($20/month).
  - The app is a client-side SPA. Note selection lives in the URL query (`/app/?n=<noteId>`) because static export can't serve dynamic routes.
  - Deep links from the marketing site: `?new=1`, `?generate=1`, `?template=<id>`.
- **Local-first data.** IndexedDB via Dexie (`apps/app/src/lib/db.ts`).
  - Tables: `notes`, `folders`, `assets` (images as compressed WebP blobs, kept on the device only), `kv`, `snapshots` (version history, last 20 per note).
  - Each note is one record holding the whole node map.
- **State.**
  - The editor uses **Zustand + immer** (`apps/app/src/store/editor-store.ts`) for undo/redo history (200 steps, text edits coalesced) and per-node subscriptions, so typing in one node doesn't re-render the others.
  - App-wide, rarely-changing state (settings, auth, theme) uses **React Context** (`src/context/`).
  - Redux was judged unnecessary.
- **Persistence.** `persistEditor()` in editor-store saves the editor's copy at most every 400 ms. It never overwrites a newer stored version: if the stored note changed underneath (via sync), that version is saved as a "(conflict copy)" note first. `app-shell.tsx` watches the stored copy and reloads the editor when a newer clean version arrives.
- **Sync (optional).** `apps/app/src/lib/sync.ts` mirrors data to Supabase Postgres tables `notes` and `folders` (one row per record: `id`, `data` jsonb, `updated_at`, `deleted_at`, `server_updated_at`; primary key `(user_id, id)`; RLS owner-only).
  - Pushes are debounced (3 s) and upserted one row at a time, so one bad row can't block the rest.
  - Realtime `postgres_changes` streams other devices' edits while the app is open; on connect, focus and `online` it also pulls.
  - Only dirty records are pushed (`updatedAt > syncedAt`).
  - Incremental pulls query `server_updated_at` (set by a database trigger), which avoids problems with device clock skew.
  - Folders use tombstones (`deletedAt`). Hard deletes are queued per uid. Table nodes are encoded as `tableJson` (kept from the earlier Firestore design; harmless).
  - On a real conflict the newer version wins and the older one is kept as a conflict copy.
  - Sign-out asks whether to keep a copy of the notes on the device or remove them.
- **Auth.** Supabase Auth (`apps/app/src/context/auth.tsx`, `lib/supabase.ts`): Google sign-in only (OAuth redirect, PKCE) returning to `/app/`; email links were removed from the UI at the owner's request (Supabase supports them if wanted later). supabase-js is lazy-loaded, so guests never download it.
- **AI.** The browser (`apps/app/src/lib/ai/ai.ts`) POSTs structured tasks to `/api/ai` with the Supabase access token. The function (`api/_lib/ai-core.js`) verifies the token against Supabase Auth (cached 60 s), applies per-user limits (30 suggestions/min, 10 others/min, 600/day; in-memory, best effort per instance), builds the prompt for the task and calls the Gemini REST API with `GEMINI_API_KEY` (model `GEMINI_MODEL`, default `gemini-3.1-flash-lite`). Tasks:
  - typeahead `suggest()` (JSON schema output)
  - `generateMap`, `summarizeToMap`, `expandNode`, `rewriteNode` (shorter, more specific, grammar, clearer, question)

  Cost controls:
  - 350 ms debounce, 2-character minimum, ideas for an empty node after 700 ms
  - abort on every keystroke
  - LRU cache of 300 entries
  - client cap of 12 suggestion calls per minute
  - 60 s back-off on HTTP 429

  The model id comes from env (default `gemini-3.1-flash-lite`; check AI Studio for the current free model).
- **Typeahead component:** `apps/app/src/components/editor/node-input.tsx`. Every node in both views edits through it.
  - It's a textarea combobox with a ghost-text layer and a marigold "Tab" chip, plus a Radix Popover listbox.
  - Tab or → accepts the ghost text. Tab with no ghost text adds a child; in outline view it indents.
  - ↑/↓ then Enter picks a suggestion. Esc dismisses the list until the text changes.
  - State is derived rather than synced (React Compiler lint rules are strict).
  - The local fallback is `lib/ai/local-suggest.ts`, rebuilt from all notes.
- **Mind map:** `components/editor/mindmap-view.tsx` with the layout code in `lib/layout.ts`.
  - The layout is a right-side tidy tree, computed in O(n), with per-depth gaps of 56/44/36 px, a 10 px row gap and a 16 px gap between first-level groups.
  - Text is measured with canvas `measureText`.
  - Connectors are bezier curves; leaves anchor on their underline.
  - Interactions: pan, ctrl/⌘-wheel zoom, pinch, fit, double-click to reset, drag to reparent, collapse buttons.
  - Map styles: `curved` (Ballpoint), `elbow`, `boxed` (Index card).
- **Outline:** `components/editor/outline-view.tsx`. It uses tree/treeitem semantics and supports pointer drag to drop before, after or inside a row.
- **Editor shell:** `components/editor/editor.tsx`. It contains:
  - the top bar (breadcrumb, view toggle, sync chip, undo/redo, export, ⋯ menu)
  - the floating toolbar (levels, style, restore view, Turn into, AI menu)
  - select-mode keyboard handling, scoped to `[data-editor-surface]` so buttons and menus keep their own keys
  - clipboard handling (branches copied as indented text; pasting an image adds an image node)
  - export
- **Library and dialogs:**
  - `components/library/sidebar.tsx`: folders, all/recent/recycle bin, rename, move, duplicate, drag a note onto a folder.
  - `components/library/account-chip.tsx`: sign-in and sync controls.
  - Dialogs in `components/dialogs/`: generate, templates, settings (including the shortcuts list), search (cmdk, ⌘K), version history. They are code-split with `next/dynamic`.
- **Offline:** `apps/app/public/sw.js` caches the app shell (navigations are network-first; `/_next/static` is cache-first).
- **Marketing site:** apps/marketing.
  - Pages: home, features, templates, use-cases (students, meeting notes, writers), blog (2 posts), privacy (draft), 404.
  - Includes generated OG images, sitemap, robots and manifest, plus JSON-LD (SoftwareApplication, Organization, WebSite, FAQPage, BreadcrumbList, BlogPosting).
  - `scripts/postexport.mjs` strips the Next runtime, so pages ship 0 KB JS.
  - `scripts/gen-dark-tokens.mjs` generates the prefers-color-scheme dark CSS from the tokens.
  - Fonts are self-hosted: Onest everywhere, plus Bricolage Grotesque (subsetted) for headlines.
  - Lighthouse (mobile, local) scored 99–100 in all four categories. `lighthouserc.json` asserts at least 0.95.

## 4. Running, testing, building

```bash
pnpm install
pnpm dev                    # app → http://localhost:3000/app/
pnpm dev:marketing          # marketing site
pnpm test                   # 39 tests: app (tree, layout, io, sanitising, local suggest, sync merge), Supabase RLS on PGlite, AI function
pnpm start                  # serve dist/ + /api/ai on http://localhost:4320 (reads .env.local)
pnpm lint                   # eslint (React Compiler rules on). Must be clean
./scripts/build-site.sh     # → dist/ (serve with: cd dist && python3 -m http.server 4320)
```

On macOS, `Start noodl.command` / `Dev noodl.command` at the repo root are double-click launchers; `TESTING.md` is the manual test checklist. The owner's working copy is in `~/Desktop/Mindnote/noodl`.

Without env vars the app runs fully local: no sign-in, no sync, local typeahead only.

Env vars (see `.env.example`): `NEXT_PUBLIC_Noodl_NOODLSUPABASE_URL`, `NEXT_PUBLIC_Noodl_NOODLSUPABASE_PUBLISHABLE_KEY` (public), `GEMINI_API_KEY` + optional `GEMINI_MODEL` (server only), `NEXT_PUBLIC_SITE_URL`; local dev only: `NEXT_PUBLIC_AI_ENDPOINT`, `AI_ALLOWED_ORIGINS`.

**How it was verified.** Playwright (Python) end-to-end runs against the static builds checked:
- map rendering, Tab/Enter node creation, ghost-text accept, picking a suggestion with ↑↓ and Enter, ideas mode
- the Generate dialog, then exporting Markdown and PNG
- persistence across reload, outline view, undo
- the keyboard scoping fix, version history restore, focus mode, the `?` shortcuts list
- rewrite preview (Insert below, custom instruction + Replace), balanced layout, conflict review (Keep both), phone accessory bar chips
- a 776-node map (culling renders ~230 nodes at fit zoom)
- mobile and dark mode

Supabase and Gemini were **mocked** (a local mock server for `/auth/v1/user`, `/rest/v1/*` and `:generateContent`, with a session injected into localStorage): guest mode hides AI; a signed-in session gets AI typeahead through `/api/ai`, map generation works, and sync upserts rows. **Real Supabase and Gemini have not been exercised yet** — follow README "Setting up Supabase + Vercel".

## 5. Gotchas for whoever continues

- **Next.js 16.4 has breaking changes.** Read `apps/*/AGENTS.md` and `node_modules/next/dist/docs/` before changing Next APIs. `cacheComponents` and `partialPrefetching` were removed because they conflict with static export.
- **No shadcn CLI here.** The shadcn registry host was blocked in the build container, so components in `apps/app/src/components/ui/` were copied from the shadcn GitHub source (new-york-v4) with imports rewritten. Add more components the same way, or run the CLI locally.
- **Fonts come from npm, not Google Fonts** (Google Fonts was also blocked here): `@fontsource-variable/onest` via `next/font/local`.
- **basePath is `/app`.** Use `/app/...` for absolute paths in public assets and the service worker, or use the metadata file conventions (`icon.svg`, `manifest.ts`).
- **React Compiler lint rules apply:** no setState directly in effect bodies, no ref reads during render, no `Date.now()` in render-scope closures. Write module-level helpers or derived state instead.
- **Keep `supabase/migrations` in step with sync.ts** (columns `id, data, updated_at, deleted_at, server_updated_at`; folder names ≤ 200 chars). Add new migrations as new files; `tests/supabase-rls` runs them all.
- **Root `package.json` is `"type": "module"`** so `api/*.js` are ESM. `scripts/serve-dist.mjs` imports `api/_lib/ai-core.js` directly for local runs.
- **Supabase free projects pause after a week without activity**; restore from the dashboard.
- **Backward compatibility:** import and backup accept both `app: "noodl"` and the old `"mindnote-web"` id. The IndexedDB database is named `noodl`; renaming it again would orphan users' local data.

## 6. Status and next steps (priority order)

Done: everything described in section 3, plus a code review pass that fixed 12 defects in sync, persistence, undo, keyboard scoping, URL sanitising and empty-node delete. Also done: moved off GCP entirely (Vercel + Supabase + Gemini AI Studio key behind `/api/ai`), phone keyboard accessory bar with suggestion chips, side-by-side conflict review dialog (`components/dialogs/conflicts-dialog.tsx`), AI rewrite preview with Replace / Insert below / Discard and custom instructions, balanced layout setting, typeahead delay slider and "Tab accepts" toggle, viewport culling above 300 nodes, Supabase RLS tests and AI function tests (both run locally and in CI).

1. **Set up Supabase + Vercel for real** (README → "Setting up Supabase + Vercel"): run the migration, enable the Google provider, set redirect URLs, create the Gemini key, import the repo in Vercel and add the env vars. Then test sign-in (Google + magic link), two-device sync, realtime updates, conflict review and AI on the deployed URL.
2. **Durable AI rate limits.** The per-user limits live in function memory (reset on cold start, per instance). If abuse shows up, move them to a Postgres table (e.g. `ai_usage(user_id, day, count)` with an RPC) — still free.
3. **Colours are decided:** the owner chose to keep the current UI palette (ballpoint blue primary, marigold reserved for AI). The noodl brand colours are used only for the logo and icons (`--brand-*` tokens). Don't re-theme the UI.
4. **Privacy page** (`apps/marketing/src/app/privacy/page.tsx`) is a draft with `[Reviewer: …]` placeholders: the Gemini data-use terms and a contact address. It needs legal review before launch.
5. **Not built yet** from DESIGN.md: multi-select / marquee selection, extra map styles (Monochrome, Highlighter, Sketch), ⌥→ accept-next-word, inline bold/italic marks, animated layout transitions.
6. **Performance.** The app's initial JS is about 300 KB gzipped, mostly React and Next. supabase-js is already lazy-loaded. Possible next steps: more code-splitting of the export libraries (they're already dynamic), and measuring the app itself with Lighthouse.
7. **Custom domain.** Add it in Vercel, update `NEXT_PUBLIC_SITE_URL` (default `https://noodl.vercel.app`) and add `https://DOMAIN/app/` to Supabase's redirect URLs.
