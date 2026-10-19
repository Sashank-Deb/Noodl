# noodl — handoff summary

Read this first if you're picking up the project in a new session. It covers what noodl is, how the code is organised, the decisions behind it, how to run and verify it, and what's left to do.

Repo: https://github.com/Sashank-Deb/Noodl (branch `main`).

## 1. What it is

**noodl** ("Let your brain wander.") is a free, local-first mind-mapping web app. Its UX follows the iOS app *MindNote – Mind Map & Notes*: every note is a single tree of nodes that you can view either as an **outline** or as a **mind map**, and switch between instantly. Every node is a **typeahead input** with AI suggestions from Gemini. When AI is off, offline or rate-limited, it falls back to phrases from your own notes.

Product goals set by the owner:
- Next.js + shadcn/ui.
- Near-zero running cost. Everything stays on Google's free tiers and there is no backend of our own.
- Auth on GCP (Firebase Auth).
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
scripts/serve-dist.mjs  Zero-dependency local server for dist/ (mirrors firebase.json routing)
tests/firestore-rules   Security rules tests (@firebase/rules-unit-testing, emulator)
Start/Dev noodl.command macOS double-click launchers; TESTING.md manual checklist
firebase.json     Hosting (dist/, headers, CSP report-only, /app/** rewrite) + Firestore
firestore.rules   Owner-only access to users/{uid}/notes and users/{uid}/folders
.github/workflows ci.yml (lint, test, build, LHCI) and deploy.yml (Firebase Hosting on main)
```

Package manager: **pnpm 10** workspaces. Node 22.

## 3. Architecture and key decisions

- **Static everything.** Both apps use `output: "export"` and are hosted on Firebase Hosting (Spark plan, free).
  - Vercel was rejected because its free Hobby plan is non-commercial only.
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
- **Sync (optional).** `apps/app/src/lib/sync.ts` mirrors data to Firestore at `users/{uid}/notes/{id}` and `users/{uid}/folders/{id}`.
  - Pushes are debounced (3 s) and written one document at a time, so one bad document can't block the rest.
  - Only dirty records are pushed (`updatedAt > syncedAt`).
  - Incremental pulls query on the server timestamp `serverUpdatedAt`, which avoids problems with device clock skew.
  - Folders use tombstones (`deletedAt`). Hard deletes are queued per uid. Tables are encoded as `tableJson` because Firestore rejects nested arrays.
  - On a real conflict the newer version wins and the older one is kept as a conflict copy.
  - Sign-out asks whether to keep a copy of the notes on the device or remove them.
- **Auth.** Firebase Auth with Google popup (falling back to redirect) and email-link sign-in. The SDK is lazy-loaded, so guests never download it. Phone/SMS sign-in isn't used because it costs money.
- **AI.** Firebase AI Logic with `GoogleAIBackend` (Gemini Developer API free tier) is called directly from the browser, so no proxy or Cloud Function is needed. App Check (reCAPTCHA v3) protects it and **must be enforced from 2 Nov 2026**. Code is in `apps/app/src/lib/ai/ai.ts`:
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
pnpm test                   # vitest (apps/app): 27 tests on tree ops, layout, import/export, sanitising, local suggest, sync merge/encoding
pnpm test:rules             # Firestore rules tests (tests/firestore-rules) on the emulator; needs Java + network. CI runs them
pnpm lint                   # eslint (React Compiler rules on). Must be clean
./scripts/build-site.sh     # → dist/ (serve with: cd dist && python3 -m http.server 4320)
firebase deploy             # needs .firebaserc (copy .firebaserc.example)
node scripts/serve-dist.mjs dist   # serve dist/ like Firebase Hosting (port 4320)
```

On macOS, `Start noodl.command` / `Dev noodl.command` at the repo root are double-click launchers; `TESTING.md` is the manual test checklist. The owner's working copy is in `~/Desktop/Mindnote/noodl`.

Without env vars the app runs fully local: no sign-in, no sync, local typeahead only.

App env vars (`apps/app/.env.example`; all are public client config): `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_APP_ID`, `_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `NEXT_PUBLIC_GEMINI_MODEL`.
Marketing env var: `NEXT_PUBLIC_SITE_URL`.

**How it was verified.** Playwright (Python) end-to-end runs against the static builds checked:
- map rendering, Tab/Enter node creation, ghost-text accept, picking a suggestion with ↑↓ and Enter, ideas mode
- the Generate dialog, then exporting Markdown and PNG
- persistence across reload, outline view, undo
- the keyboard scoping fix, version history restore, focus mode, the `?` shortcuts list
- rewrite preview (Insert below, custom instruction + Replace), balanced layout, conflict review (Keep both), phone accessory bar chips
- a 776-node map (culling renders ~230 nodes at fit zoom)
- mobile and dark mode

Gemini was **mocked** by intercepting `**/*generateContent*`; the test build used fake Firebase env values. **Real Firebase (Auth, Firestore rules, AI Logic, App Check) has not been exercised yet.** The setup steps are in README.md under "Turning on Firebase".

## 5. Gotchas for whoever continues

- **Next.js 16.4 has breaking changes.** Read `apps/*/AGENTS.md` and `node_modules/next/dist/docs/` before changing Next APIs. `cacheComponents` and `partialPrefetching` were removed because they conflict with static export.
- **No shadcn CLI here.** The shadcn registry host was blocked in the build container, so components in `apps/app/src/components/ui/` were copied from the shadcn GitHub source (new-york-v4) with imports rewritten. Add more components the same way, or run the CLI locally.
- **Fonts come from npm, not Google Fonts** (Google Fonts was also blocked here): `@fontsource-variable/onest` via `next/font/local`.
- **basePath is `/app`.** Use `/app/...` for absolute paths in public assets and the service worker, or use the metadata file conventions (`icon.svg`, `manifest.ts`).
- **React Compiler lint rules apply:** no setState directly in effect bodies, no ref reads during render, no `Date.now()` in render-scope closures. Write module-level helpers or derived state instead.
- **Keep the Firestore rules in step with sync.ts.** Rules require `serverUpdatedAt == request.time`, and folder names must be ≤ 200 characters.
- **Backward compatibility:** import and backup accept both `app: "noodl"` and the old `"mindnote-web"` id. The IndexedDB database is named `noodl`; renaming it again would orphan users' local data.

## 6. Status and next steps (priority order)

Done: everything described in section 3, plus a code review pass that fixed 12 defects in sync, persistence, undo, keyboard scoping, URL sanitising and empty-node delete. Also done: phone keyboard accessory bar with suggestion chips, side-by-side conflict review dialog (`components/dialogs/conflicts-dialog.tsx`), AI rewrite preview with Replace / Insert below / Discard and custom instructions, balanced layout setting, typeahead delay slider and "Tab accepts" toggle, viewport culling above 300 nodes, Firestore rules tests (written; run in CI only — the emulator can't be downloaded in the build container, so they have **not been run yet**).

1. **Set up a real Firebase project**, following README "Turning on Firebase".
   - Enable Google + email-link sign-in, create Firestore and deploy the rules, enable AI Logic (Gemini Developer API), and register App Check with reCAPTCHA v3 and **enforce** it.
   - Set GitHub repo variables and the `FIREBASE_SERVICE_ACCOUNT` secret for `deploy.yml`.
   - Then test sign-in, two-device sync, conflicts, the email link and real Gemini suggestions.
2. **Run the Firestore rules tests** (`pnpm test:rules`, or let CI run them) and fix anything they catch.
3. **Brand alignment.** The noodl logo and icons are applied, but the UI theme still uses the original "ballpoint blue + marigold AI" tokens. Decide whether to move the primary/accent colours to the brand palette (ink #151515, butter #FFF4CC, noodle gold #FFB83D, warm white #FFFDF7). If so, update `packages/tokens/tokens.css` and check AA contrast.
4. **Privacy page** (`apps/marketing/src/app/privacy/page.tsx`) is a draft with `[Reviewer: …]` placeholders: the Gemini data-use terms and a contact address. It needs legal review before launch.
5. **Not built yet** from DESIGN.md: multi-select / marquee selection, extra map styles (Monochrome, Highlighter, Sketch), ⌥→ accept-next-word, inline bold/italic marks, animated layout transitions.
6. **Performance.** The app's initial JS is about 300 KB gzipped, mostly React and Next. The Firebase SDKs are already lazy-loaded. Possible next steps: more code-splitting of the export libraries (they're already dynamic), and measuring the app itself with Lighthouse.
7. **Custom domain.** Update `NEXT_PUBLIC_SITE_URL` (default `https://noodl.web.app`) and add the domain to Firebase Auth's authorized domains.
