# MindNote Web: design spec v1

Files in this folder:

- `tokens.css`: every colour, font, radius and motion token as shadcn-compatible CSS variables (Tailwind v4 `@theme inline`). Copy it into `app/globals.css`.
- `mockups.html`: static frames A to F. Open in a browser; tokens are inlined, so it matches `tokens.css` exactly.
- `DESIGN.md`: this file. Where the mockups and this file disagree, this file wins.

Working name is "MindNote Web". It replicates the UX of the iOS app *MindNote – Mind Map & Notes*, but the brand, mark and artwork are our own.

---

## 1. Design concept: ballpoint and highlighter

A note-taking tool should feel like a good pen on clean paper, not like a dashboard.

| Role | Token | Meaning |
|---|---|---|
| Paper | `--canvas`, `--canvas-dot` | A cool off-white infinite canvas with a 22 px dot grid. Calm and empty by default, never cream. |
| Ink | `--foreground`, `--node-root-bg` | Graphite text; the root node is a solid ink pill. |
| Pen | `--primary` (ballpoint blue) | The one interactive colour: primary buttons, selection, focus, links, caret. |
| Highlighter | `--ai`, `--ai-soft`, `--ai-strong` | Marigold, used **only** for AI. If something is yellow, Gemini made it or is offering it. Users learn this in one session and it keeps AI output attributable. |
| Branches | `--branch-1 … --branch-8` | Hue per first-level branch, inherited by all descendants. |

Principles:

1. **The note is the interface.** Chrome floats above the canvas in small toolbars and disappears in focus mode (`⌘.`). No permanent inspector panels.
2. **One tree, two shapes.** Outline and mind map are views of the same node list. Toggling never reloads, loses selection or loses the caret.
3. **Keyboard first, touch friendly.** Every action has a key; every key has a visible, ≥ 44 px touch target on mobile.
4. **AI is a suggestion, never an author.** AI output arrives as ghost text, a dropdown or a preview the user accepts. Nothing is written into a note without a keypress or click.
5. **Offline is the default state, not an error.** Guest mode is complete. Sign-in is an upgrade offered quietly in the account chip.

Hand-crafted touch (from the Excalidraw benchmark, used sparingly): curved connectors that thin out with depth, leaves underlined like handwriting, a dashed hand-drawn arrow on the marketing hero, a slightly rotated outline card. No rough/sketchy strokes in the default style; that is an opt-in map style ("Sketch").

---

## 2. Typography

| Variable | Google Font | Use |
|---|---|---|
| `--font-sans` | **Onest** (400, 500, 600, 700; latin + cyrillic) | All UI and all node text. Open apertures and tall x-height stay legible at 13 px in the sidebar and at 50 % canvas zoom. |
| `--font-display` | **Bricolage Grotesque** (variable `opsz 12..96`, `wdth 75..100`, `wght 400..800`) | Marketing headlines, empty-state headings, onboarding. Never in the editor chrome. Set at `wdth 92`, `opsz 96`, tracking −0.035em at ≥ 56 px. |
| `--font-mono` | **JetBrains Mono** (400, 500) | `<kbd>` hints, JSON/Markdown export previews. |

Type scale (UI, rem at 16 px root; ratio ≈ 1.125 for UI, jumps for display):

| Token | Size / line-height / weight | Use |
|---|---|---|
| `text-xs` | 12 / 16 / 400–550 | meta lines, counts, kbd labels (11 mono) |
| `text-sm` | 13.5 / 20 / 450–550 | buttons, menus, sidebar secondary |
| `text-base` | 14 / 20 / 400–600 | sidebar rows, leaf nodes on canvas |
| `text-md` | 15 / 24 / 400–600 | outline rows (desktop), L1 nodes |
| outline mobile | 16 / 24 | outline rows ≤ 640 px (prevents iOS zoom on focus) |
| root node | 17 / 20 / 650 | |
| note title | 30 / 34 / 700, −0.02em | outline view title |
| display | 56–84 / 0.98 / 700 | marketing only |

Rules: sentence case everywhere, no all-caps labels, tabular numerals for counts and costs, max line length 72ch in outline text nodes (they wrap).

---

## 3. Layout grid and breakpoints

| Name | Width | Shell |
|---|---|---|
| `sm` (phone) | < 640 | Single column. Library is a left `Sheet` (`side="left"`, width `min(86vw, 340px)`). Top bar 52 px. Keyboard accessory bar when editing. |
| `md` (tablet portrait) | 640–1023 | Editor full width; library is a `Sheet` opened from the panel button; can be pinned (becomes the `lg` layout). |
| `lg` (tablet landscape / laptop) | 1024–1439 | iPad-style split view: sidebar 272 px + editor. Sidebar collapsible to 0 (`⌘\`). |
| `xl` | ≥ 1440 | Sidebar 288 px. Outline column max 760 px. |

Spacing scale: 4 px base (`1 = 4px`). Common gaps: 4, 8, 12, 16, 24, 32, 48.
Radii: `--radius` 12 px. Buttons/inputs 10 px (`rounded-md`), menu items 8 px, popovers 12 px, dialogs 18 px, L1 nodes 10 px, root 14 px, image nodes 10 px.

### App shell (lg)

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│ ◉ Name  ⚙ ▤ │ Folder › Note title     [Outline|Mind map]   ●Local  Export ⋯│ 52px top bar
│ [Search ⌘K ] ├──────────────────────────────────────────────────────────┤
│ [New][✦Gen] │          ┌ All L1 L2 L3 │ ●●● Ballpoint ▾ │ ↺ Restore ┐     │ floating, top-centre
│ All notes   │                                                          │
│ Recent      │                ┌Site┐── Raised beds                     │
│ Templates   │   (Root)───────┤    └── …                               │
│ Folders  +  │                └People┐── …                            │
│ ▾ Garden    │                                                          │
│   · notes   │                                                          │
│ ▸ Work      │ ┌ − 100% + │ ⛶ ┐                            ┌ ? Shortcuts┐│ floating, bottom
│ Recycle Bin │                                                          │
│ ───────────  │                                                          │
│ (o) Guest    │                                                          │
│ Sign in…     │                                                          │
└──────────────┴──────────────────────────────────────────────────────────┘
```

- Top bar is a 3-column grid (`1fr auto 1fr`): breadcrumb left, view toggle centred, sync + export + overflow right.
- Floating toolbars: 12 px from canvas edges, `--canvas-toolbar` with `backdrop-blur(10px)`, 1 px `--border`, `--canvas-shadow`, radius 12, inner padding 4.
- Outline view has no floating toolbars; content column centred, `max-width: 720px`, 24 px side padding (16 px on `sm`).

---

## 4. Screens and states

### 4.1 Library (sidebar / sheet)

Content top to bottom: header (mark, product name, Settings, Collapse), Search trigger (opens Command palette), two actions (**New note** primary, **Generate** AI-styled), fixed rows (All notes, Recent, Templates), Folders section with `+`, folder tree (folders expand to show their notes inline, 2 levels max), Recycle Bin with count, footer account chip.

Note row: title (14/550) + meta line "17 nodes, edited just now" (12, muted). Active note: `--sidebar-accent` fill + 2 px inset left bar in `--sidebar-primary`.

Row actions (hover `⋯`, right-click, or long-press on touch) via `DropdownMenu`: Rename (F2), Duplicate, Move to… (submenu of folders + New folder), Export…, Delete (moves to Recycle Bin, Sonner toast "Moved to Recycle Bin" with **Undo**). Folders: Rename, New note here, Delete folder (dialog: "Delete folder and its 5 notes? They move to the Recycle Bin.").

Drag a note onto a folder to move it (drop target highlights with `--node-drop`).

States: loading (3 skeleton rows), empty folder ("This folder is empty. **New note** or drag notes here."), no search results (see §10).

### 4.2 Search (Command palette)

`⌘K` / `Ctrl K` opens shadcn `CommandDialog`. Groups: Notes (title matches), Nodes (text matches inside notes, shows breadcrumb "Garden club › Community garden › Workshops"), Actions (New note, Generate with AI, Import, Toggle theme, Open settings). Enter on a node result opens the note and selects/centres that node.

### 4.3 Editor: mind map view

See §6 and §7. States:
- **Fresh note**: root node "Central idea" in edit mode, caret placed, hint below: "Type a topic. Tab adds a branch."
- **Selected node**: 2 px `--node-selected` ring + 4 px halo. A node action bar (floating, 8 px above node, same style as toolbars) shows: Add child, Add sibling, Turn into (Text / Link / Image / Table), Rewrite with AI (sparkle), More (⋯). Hidden while editing and while panning.
- **Editing**: node becomes an input (white `--node-bg`, 1 px border, focus ring). Typeahead per §8.
- **Collapsed node**: child count pill after text (`collapsed-count`), connector stub of 12 px.
- **Multi-select** (`Shift`-click or marquee drag on blank canvas with `Shift`): all selected nodes ringed; actions apply to all.
- **Dragging a node**: node lifts (shadow, 2° tilt, 0.9 opacity), original slot shows dashed outline, candidate parent highlights with `--node-drop` fill and a ghost connector.
- **Large maps** (> 500 nodes): render only nodes intersecting the viewport + 200 px margin.

### 4.4 Editor: outline view

Row anatomy (desktop): `[grip 20][disclosure 22][gap 6][text …][row actions]`, min-height 34 (40 on `sm`), radius 8, indent 24 px per level, 1 px `--border` guide line under each disclosure column.
- Disclosure: chevron (down = expanded, right = collapsed) tinted with the branch colour for parents; 7 px dot in branch colour for leaves.
- L1 rows are weight 600; deeper rows 400.
- Hover: `--muted` fill, grip appears (cursor `grab`), row actions appear right: Add child, Rewrite with AI, More.
- Selected: `--accent` fill + 1.5 px inset ring.
- Drag: insertion line 2 px `--node-selected`, indented to the target depth; horizontal pointer position chooses depth (every 24 px = one level), like Workflowy.
- Media nodes render inline under their row (image max 320 × 200, table full column width).
- Title (30/700) is the root node's text; editing it edits the root.

### 4.5 Templates

Route `/templates`, or a `Dialog` from "New note ▾". Grid of cards (2 cols md, 3 cols lg): each card shows a mini map thumbnail (SVG, no text smaller than 8 px), name, node count. Starter set: Blank, Project plan, Meeting notes, Book summary, SWOT, Weekly review, Study guide, Trip plan. "Use template" creates a copy in the current folder.

### 4.6 AI dialogs

- **Generate a map** (frame C): `Dialog` 600 px. Tabs: "From a prompt" / "Summarize pasted text". Prompt `Textarea` (autofocus, 3 rows min, grows to 8), example chips, options row: Depth `ToggleGroup` (2/3/4, default 3), Main branches (Auto/4/6/8), Language `Select` (defaults to UI language), Add to `Select` (New note / As children of selected node). Live draft preview streams in as an indented list with shimmer rows for pending lines. Footer: privacy line "Your prompt is sent to Google Gemini. Notes stay on this device.", Cancel, **Generate map** (`⌘⏎`). While streaming the primary becomes **Stop**. On finish: "Open map" (primary) and "Try again". Errors: inline `Alert` above footer with retry.
- **Summarize pasted text**: same dialog, textarea placeholder "Paste an article, transcript or notes (up to 20,000 characters)", character counter, output is a note titled from the text.
- **Rewrite node**: `DropdownMenuSub` from node menu, or `⌘J`. Options: Make shorter, Expand into children, Fix spelling and grammar, Make it a question, Custom instruction… (opens a small `Popover` input). Result shows inline as a diff card under the node: old text struck through in muted, new text in `--ai-soft` wash; buttons **Replace** (⏎), **Insert below**, **Discard** (Esc). "Expand into children" previews new children as ghost nodes (dashed border, 60 % opacity) on the map.
- AI off (Settings): all sparkle buttons, typeahead AI and Generate disappear; typeahead still offers local suggestions.

### 4.7 Account, sign-in and sync

- Account chip (sidebar footer). Guest: dashed avatar ring with a drive icon, "Guest", link-coloured "Sign in with Google to sync". Click opens a `Popover`: two sentences ("Your notes are saved in this browser. Sign in to back them up and open them on other devices."), **Continue with Google** button, "Notes on this device are merged into your account." Signed in: avatar photo, name, "Synced with Google"; popover shows email, last sync time, **Sync now**, Sign out (confirm: "Keep a copy on this device?" two buttons).
- Sync status chip (top bar, also `aria-live="polite"`):

| State | Icon (lucide) | Label | Token |
|---|---|---|---|
| local only | `hard-drive` | Local only | `--status-local` |
| synced | `cloud-check` | Synced | `--status-synced` |
| syncing | `refresh-cw` (rotating 1 s linear) | Syncing | `--status-syncing` |
| offline | `cloud-off` | Offline, changes saved here | `--status-offline` |
| conflict | `triangle-alert` | Needs review | `--status-conflict` |

- Conflict: clicking opens a `Dialog` with both versions side by side as mini outlines, differences highlighted, actions: Keep this device's version / Keep the other version / Keep both (creates "Community garden (copy)").

### 4.8 Export and import

Top bar **Export** opens a `DropdownMenu`:
- Image: PNG, JPEG (submenu: scale 1×/2×/3×, background: canvas / transparent (PNG only) / white)
- Document: PDF (fit to one page / A4 tiled), Markdown, HTML
- Data: JSON (lossless, versioned schema)
- separator, Import… (JSON or Markdown file; also accepts drag-and-drop of `.md`/`.json` onto the window, showing a full-window drop overlay "Drop to import as a new note").
Exports of the map use the current map style and theme; a Sonner toast "Exported Community garden.png".

### 4.9 Settings

`Dialog` (lg) / full-screen `Sheet` (sm), left `Tabs` list: General, Editor, AI, Data.
- General: Theme `ToggleGroup` (Light / Dark / System), Language `Select`.
- Editor: Default view (Outline / Mind map), Map style picker (cards with mini previews), Map layout (Right / Balanced), Show dot grid `Switch`, Reduce motion (System / On).
- AI: Use AI suggestions `Switch` (master), Typeahead suggestions `Switch`, Suggestion delay `Slider` (150–600 ms), "Prompts are sent to Google Gemini" disclosure.
- Data: Storage used, Export all (zip of JSON), Import, Open data recovery, Delete all local data (destructive, type-to-confirm).

### 4.10 Recycle Bin and data recovery

- Recycle Bin (route `/trash`): list of deleted notes and folders with "Deleted 3 days ago", original folder, actions **Restore** and Delete forever (confirm dialog). Header action Empty Recycle Bin. Items auto-delete after 30 days (copy: "Notes here are deleted for good after 30 days.").
- Data recovery (route `/recovery`, linked from Settings > Data and from the error boundary): every note keeps the last 20 snapshots locally (taken on open, every 5 minutes of editing, and before AI replace/generate). Two-pane: snapshot list (timestamp, node count, reason "Before AI rewrite") and read-only outline preview. Actions: Restore this version (replaces, creates a snapshot of current first), Restore as copy, Download JSON. Also lists "Unreadable notes" recovered from storage with Download raw.

---

## 5. Component inventory (shadcn mapping)

| UI element | shadcn / Radix | Notes |
|---|---|---|
| Sidebar | `Sidebar` (shadcn sidebar block) + `Sheet` on md/sm | `collapsible="offcanvas"`, width var `--sidebar-width: 272px` |
| Search | `CommandDialog`, `Command*` | ⌘K |
| View toggle | `ToggleGroup type="single"` | styled as segmented control, `role="radiogroup"` |
| Level control | `ToggleGroup` (All/L1/L2/L3) | |
| Map style picker | `DropdownMenu` with `DropdownMenuRadioGroup` | swatches preview |
| Node action bar | custom `Toolbar` (Radix Toolbar) | floats via `@floating-ui` |
| Node menu, row menu | `DropdownMenu`, `DropdownMenuSub`, `ContextMenu` (right-click) | same item list for both |
| Typeahead dropdown | `Popover` (non-modal, `onOpenAutoFocus` prevented) + `Command` list in controlled mode | focus stays in node input; `aria-activedescendant` |
| Generate / Summarize | `Dialog`, `Tabs`, `Textarea`, `ToggleGroup`, `Select` | |
| Rewrite custom | `Popover` + `Input` | |
| Account | `Popover`, `Avatar`, `Button` | |
| Sync chip | `Tooltip` + `Badge`-like button | |
| Export | `DropdownMenu` with subs | |
| Settings | `Dialog` + `Tabs orientation="vertical"`, `Switch`, `Slider`, `Select` | |
| Confirmations | `AlertDialog` | |
| Toasts | `Sonner` | bottom-centre on sm, bottom-right on lg; always offer Undo for destructive actions |
| Tooltips | `Tooltip` | 500 ms delay, shows label + `<kbd>` |
| Recycle bin / recovery lists | `Table` (lg) / list (sm), `ScrollArea`, `ResizablePanelGroup` (recovery) | |
| Kbd hint | custom `Kbd` | mono 11 px, 1 px border + 2 px bottom border |

Icons: lucide-react, 16 px in UI (15 in dense buttons, 18 on mobile toolbars), `strokeWidth={1.75}`. Map: `list-tree` (Outline), `network`/`git-fork` rotated or a custom map glyph (Mind map), `sparkles` (AI), `hard-drive`, `cloud-check`, `cloud-off`, `refresh-cw`, `triangle-alert`, `download`, `upload`, `rotate-ccw` (Restore view), `maximize` (Fit), `grip-vertical`, `chevron-right/down`, `link`, `image`, `table`, `type`, `trash-2`, `folder`, `file-text`, `layout-template`, `settings-2`, `wifi-off`, `hourglass`.

Buttons: `default` = primary blue; `ai` variant (new): `bg-ai-soft text-ai-strong ring-1 ring-ai/55`; `ghost`; `outline`; `destructive`. Sizes sm 32, default 36, lg 48 (marketing). Mobile toolbar buttons 44 × 40 min.

---

## 6. Node anatomy (map view, default style "Ballpoint")

| Depth | Shape | Height | Padding x | Radius | Font | Fill / border |
|---|---|---|---|---|---|---|
| 0 root | solid pill | 48 | 20 | 14 | 17 / 650 | `--node-root-bg` / none, shadow `0 2px 0 rgb(0 0 0/.12), 0 10px 24px -12px` |
| 1 | tinted pill | 36 | 14 | 10 | 15 / 600 | `color-mix(in oklch, var(--b) 13%, var(--node-bg))` / 1.5 px `color-mix(var(--b) 60%, var(--node-bg))` |
| ≥ 2 | underlined text | 30 | 6 | 0 | 14 / 450 | none / 2 px bottom border `var(--b)` |
| editing (any depth) | input box | 34 (grows per line +20) | 10 left, 5 right | 9 | depth font | `--node-bg`, 1 px `--node-border`, ring 2 px `--node-selected` + 4 px halo |

`--b` is the node's branch colour: first-level child *i* gets `--branch-((i mod 8)+1)`; descendants inherit.

- Multi-line text: max width 280 px (L≥2) / 240 px (L1), wraps; height grows by line-height (20 px). Anchor stays at the underline (bottom) for leaves, vertical centre for pills.
- Link node: text in `--primary` with underline + `link` icon 13 px; click opens in new tab (`⌘`-click on canvas, plain click in outline).
- Image node: card 1 px border, radius 10, padding 6; thumbnail max 200 × 140 on map, caption row with filename. Anchor at vertical centre.
- Table node: compact table (13.5 px, cell padding 6/12), max 6 visible rows on map then "+4 rows"; anchor centre.
- Collapsed: count pill 20 px high, `--secondary`, after text.

### Connectors

From parent anchor `P` to child anchor `C`:

- Pills (depth 0, 1) anchor at **right-middle** (outgoing) and **left-middle** (incoming).
- Underlined leaves (depth ≥ 2) anchor at **bottom-left / bottom-right of the underline**, so the branch flows straight into the underline like a pen stroke.

```
k  = (C.x − P.x) × 0.5
d  = M P.x,P.y  C (P.x + k),P.y  (C.x − k),C.y  C.x,C.y
```

Cubic bezier, horizontal tangents at both ends. Stroke = child's branch colour, `stroke-linecap: round`, no fill. Stroke width by parent depth: root → L1 **3 px**, L1 → L2 **2 px**, deeper **1.75 px** (the tapering gives the hand-made feel). For the balanced (left side) layout, mirror x.

### Map styles (`data-map-style` on the canvas)

| Style | Description |
|---|---|
| Ballpoint (default) | As above. |
| Index card | Every node is a white card (radius 8, 1 px border, 3 px left edge in branch colour); connectors are orthogonal elbows with 8 px rounded corners. |
| Monochrome | All branches `--foreground` at 70 %, root inverted; for printing. |
| Highlighter | Leaves get a branch-tinted 30 % marker wash behind text instead of underline; slightly rotated −0.5° per node alternating. |
| Sketch | Connectors and borders rendered with roughjs (roughness 0.8, bowing 1), node text in Onest still. Opt-in only. |

---

## 7. Mind map layout algorithm

Default **right-side tidy tree** (what the mockups use, implemented in `mockups.html`'s generator exactly):

Constants: `H_GAP = {from root: 56, from L1: 44, deeper: 36}`, `ROW_GAP = 10`, `GROUP_GAP = 16` (extra space between first-level subtrees).

1. **Measure** every visible node (text width via a hidden measuring element or `canvas.measureText` with the node font + padding; cache by text+depth+style).
2. **x**: `root.x = 0`; for each child `child.x = parent.x + parent.width + H_GAP[parent.depth]` (per-parent, not per-column, so short parents keep their children close, as in MindNote).
3. **y** (post-order, single cursor):
   - Leaf (or collapsed node): `node.cy = cursor + node.height / 2`; `cursor += node.height + ROW_GAP`.
   - Before each first-level child after the first, `cursor += GROUP_GAP`.
   - Parent: `node.cy = (firstChild.cy + lastChild.cy) / 2`.
   - If a parent is taller than its children's span (e.g. image node), shift the children block down so the span is centred on the parent and advance the cursor to `max(cursor, parent.bottom + ROW_GAP)`.
4. Translate so the root's centre is at world origin (0, 0).
5. Re-layout is O(n) and runs on every structural change; positions animate (see §11). Text edits re-layout only when the width or line count changes.

**Balanced layout** (setting "Map layout: Balanced"): split first-level children into two groups with the most even total leaf count, preserving order (first half right, second half left); lay out the left group with mirrored x (`child.x = parent.x − H_GAP − child.width`) and its own cursor; centre both groups vertically on the root.

Camera:
- Pan: drag blank canvas, two-finger scroll/trackpad, `Space`+drag (in select mode), arrow keys with nothing selected.
- Zoom: `⌘/Ctrl` + wheel or pinch, around the pointer. Range 10 %–400 %. `⌘=` / `⌘-` step 10 %, `⌘0` → 100 %.
- **Double-click blank canvas: reset zoom to 100 % and centre the root** (MindNote behaviour). Double-click a node: edit.
- **Restore view**: fit all visible nodes with 64 px padding, max zoom 100 %. `⇧1`.
- Selection always kept in view: if keyboard navigation moves selection off-screen, pan by the minimum distance + 48 px.
- **Expand by level**: All / L1 / L2 / L3 sets the collapsed flag of every node at depth ≥ N (L1 = only first-level visible). Manual expand/collapse after that persists per node. Keys `⌥1`, `⌥2`, `⌥3`, `⌥0` (all).

---

## 8. Typeahead / autocomplete (every node)

Applies to every text node in both views, while editing.

### Behaviour

| Parameter | Value |
|---|---|
| Trigger | caret at end of text (no selection), node in edit mode, AI on |
| Min characters | 2 in the current node (0 for an empty new node: shows "Ideas for this branch" with no ghost text, only after 600 ms idle) |
| Debounce | 220 ms after last keystroke (user-adjustable 150–600 ms) |
| Request timeout | 2,500 ms, then fall back to local |
| Cancel | abort in-flight request on every keystroke (AbortController); drop late responses whose prefix no longer matches |
| Max suggestions | 5 total: up to 4 AI + local matches to fill (local always ≥ 1 if any exist) |
| Ghost text | the top suggestion's remainder when it **starts with** the typed text (case-insensitive); otherwise no ghost, dropdown only |
| Cache | LRU 200 entries keyed by `noteId + nodeId + text + context hash`; typing back over a cached prefix reuses it instantly |
| Context sent | note title, ancestor path (root → parent texts), up to 12 sibling texts, up to 8 existing child texts, node language; max 1,500 chars; never other notes |
| Model call | Gemini, JSON list response, temperature 0.4, max 60 tokens per suggestion |
| Local suggestions | fuzzy prefix match over all node texts in the user's notes (excluding identical text already in siblings), ranked by frequency then recency; label shows source note |

### Keys while a suggestion is showing

| Key | Action |
|---|---|
| `Tab` | **If ghost text is visible: accept it** (insert remainder, caret to end, dropdown closes). **Otherwise: add child** (normal Tab). |
| `→` / `End` | accept ghost text, only when caret is at end of text (else moves caret normally) |
| `⌥→` / `Ctrl →` | accept next word of ghost text |
| `↓` / `↑` | move highlight in dropdown (opens it if only ghost is shown); ghost text updates to the highlighted item when it prefix-matches |
| `Enter` | if a dropdown item is highlighted by the user (moved with arrows): replace node text with it. Otherwise: commit and add sibling (normal Enter). |
| `Esc` | first press dismisses ghost + dropdown for this edit session (until the text changes by ≥ 1 char); second press exits edit mode |
| `Shift Tab` | outdent (never accepts) |
| Mouse | click an item = replace text; hovering highlights |

**Tab conflict, documented resolution:** Tab is overloaded only when ghost text is visibly on screen, and the node shows a small `Tab` key chip (marigold) at the end of the ghost text to make that state explicit. After accepting, the ghost disappears, so a second Tab adds a child: "Tab accepts, Tab again branches". Users who never want Tab to accept can turn off "Tab accepts suggestions" in Settings > AI (→ still works). Screen readers: when ghost text appears we announce "Suggestion: Composting for beginners. Tab to accept." via an `aria-live="polite"` region (throttled to once per 1.5 s).

### States (frame A2)

1. **Idle / typing**: nothing shown below min chars or during debounce.
2. **Loading**: dropdown shows header "Thinking about {parent}" with pulsing sparkle and 3 shimmer rows (`--muted` → `--ai-shimmer`). If cached/local results exist they show immediately and AI rows shimmer beneath them. Never blocks typing.
3. **Ready**: header "Suggestions from {parent} and N siblings" with sparkle; highlighted row has `--ai-soft` wash + 2 px inset left bar `--ai`; the completion part of each item is weight 650, the typed part 400. Footer key legend: ↑↓ choose, ⏎ insert, Tab accept, Esc close.
4. **Offline** (`navigator.onLine === false` or network error): header icon `wifi-off`, "Offline. Showing matches from your notes". Only local rows (file icon + source note name).
5. **Rate limited / quota** (HTTP 429 or quota error): header icon `hourglass`, "AI paused for {s} s. Local matches only." Back-off 2^n s up to 60 s, resumes automatically. No toast (avoid noise); one Sonner toast only if AI has been unavailable > 5 min.
6. **AI off**: same as offline but without header message.
7. **No results**: dropdown hidden (never show an empty dropdown).

Dropdown geometry: `Popover` anchored to node bottom-left, 8 px offset, width 330 (min node width), max 5 items (34 px rows), radius 12, shadow `0 16px 40px -12px`. Collision: flips above the node if < 240 px below; on map, follows the node during pan/zoom but scales at 100 % regardless of zoom.

Mobile (frame D): no dropdown. Suggestions become a horizontal chip strip in the keyboard accessory bar (first chip highlighted = ghost text); tapping a chip replaces text. Accessory bar also has Outdent, Indent (= add child), New sibling, Rewrite with AI, Insert image, **Done**.

---

## 9. Interaction and keyboard shortcuts

Two modes: **Select mode** (a node is selected, not editing) and **Edit mode** (caret in a node). `⌘` = Ctrl on Windows/Linux.

### Global

| Shortcut | Action |
|---|---|
| `⌘K` | Search / command palette |
| `⌥N` (browsers reserve `⌘N`) | New note |
| `⌘⇧G` | Generate map with AI |
| `⌘\` | Toggle sidebar |
| `⌘⇧M` | Toggle Outline / Mind map |
| `⌘.` | Focus mode (hide sidebar and toolbars) |
| `⌘⇧E` | Export menu |
| `⌘,` | Settings |
| `⌘Z` / `⌘⇧Z` | Undo / redo (per note, 200 steps) |
| `?` | Shortcuts sheet |

### Select mode

| Key | Action |
|---|---|
| `Tab` | Add child (enters edit mode on it) |
| `Enter` | Add sibling below (edit mode) |
| `⇧Enter` | Add sibling above |
| `Space` or `F2` | Edit selected node (caret at end) |
| `Delete` / `Backspace` | Delete node and subtree (toast with Undo) |
| `↑ ↓` | Previous / next node in outline order (map: nearest node vertically) |
| `← →` | Map: parent / first child. Outline: collapse / expand, then parent / child |
| `⌥↑ ⌥↓` | Move node up / down among siblings |
| `⇧Tab` / `⌘]` `⌘[` | Outdent / indent |
| `⌘;` | Collapse / expand selected |
| `⌥0 ⌥1 ⌥2 ⌥3` | Expand all / to level 1 / 2 / 3 |
| `⌘J` | Rewrite with AI menu |
| `⌘C ⌘X ⌘V` | Copy / cut / paste subtree (pastes as child; pasting multi-line text creates nodes by indentation) |
| `⌘D` | Duplicate subtree |
| `⇧1` | Restore view (fit) |
| `⌘0` / `⌘=` / `⌘-` | Zoom 100 % / in / out |
| `Esc` | Clear selection |

### Edit mode

| Key | Action |
|---|---|
| `Enter` | Commit and add sibling (or pick highlighted suggestion, §8) |
| `⇧Enter` | New line inside node |
| `Tab` | Accept ghost text if visible, else commit and add child |
| `⇧Tab` | Outdent |
| `Esc` | Dismiss suggestions, then exit edit (keeps text) |
| `Backspace` on empty node | Delete node, select previous |
| `⌘B` / `⌘I` | Bold / italic (inline marks) |
| `⌘L` | Turn selection into a link (URL popover); `⌘K` stays global search |

Pointer: click selects, double-click node edits, double-click blank resets zoom, drag node reparents/reorders, drag blank pans (Space+drag also), `Shift`+drag blank = marquee select, right-click = context menu, long-press (touch) = context menu, pinch = zoom.

---

## 10. Empty states and copy

Voice: plain, short, active. Name what will happen. Errors say what went wrong and what to do.

| Where | Heading (display face, 24) | Body | Action |
|---|---|---|---|
| First run, no notes | Start with one idea. | Type a topic and press Tab to branch it. Everything stays on this device. | **New note** · Generate with AI · Import |
| Empty folder | Nothing in Garden club yet. | Create a note here or drag notes onto the folder. | **New note** |
| Search, no results | No notes match "compst". | Check the spelling or search inside notes with ⌘K. | Clear search |
| Recycle Bin empty | Recycle Bin is empty. | Deleted notes stay here for 30 days. | none |
| Recovery, no snapshots | No earlier versions yet. | Versions are saved every few minutes while you edit. | none |
| AI error (generate) | — | Gemini didn't respond. Your prompt is still here. | **Try again** |
| Import failed | — | That file isn't a MindNote JSON or Markdown outline. | Choose another file |
| Storage nearly full | — | This browser is almost out of space for notes. Export a backup or sign in to sync. | Export all |

Toasts (Sonner) follow verb consistency: "Moved to Recycle Bin" (Undo), "Restored Community garden", "Exported Community garden.png", "Copied 6 nodes", "Synced", "Signed in as rosa@…".

---

## 11. Motion

| Token | Value | Use |
|---|---|---|
| `--dur-1` | 90 ms | hover, press, ToggleGroup thumb |
| `--dur-2` | 160 ms | popovers, menus, ghost text fade-in, tooltips |
| `--dur-3` | 240 ms | expand/collapse, node reflow, view toggle cross-fade, sheet |
| `--dur-4` | 360 ms | camera fit / Restore view / reset zoom |
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | most enters, layout reflow |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` | camera moves, shimmer |
| `--ease-spring` | `cubic-bezier(.34,1.4,.64,1)` | new node pop-in (scale .92 → 1) only |

- Layout reflow: nodes tween `transform` (never top/left) to new positions; connectors are recomputed per frame from node positions (or animate path `d` via FLIP on the endpoints).
- Expand: children fade + slide 8 px from the parent's anchor; collapse reverses in `--dur-2`.
- View toggle: 240 ms cross-fade, the selected node keeps focus and is scrolled/panned into view.
- Ghost text: fade in 160 ms, no movement. Typing replaces it instantly (no fade out).
- Generate: drafted nodes appear one by one at 40 ms stagger as they stream, not faster than the text arrives.
- The caret blinks at 1.1 s.
- `prefers-reduced-motion: reduce` (or Settings > Reduce motion): all tweens become instant except opacity fades ≤ 100 ms; camera jumps; shimmer becomes static `--ai-soft`; sparkle doesn't pulse; syncing icon doesn't rotate (label alone carries state).

---

## 12. Accessibility

- Contrast: all text tokens ≥ 4.5:1 on their surfaces in both themes (muted-foreground 5.3:1 light / 6.5:1 dark; ghost text 4.5:1 / 4.6:1; `--ai-strong` 6.2:1 on white). Branch strokes and `--ring` ≥ 3:1 against `--canvas`. Text never sits on a branch colour; L1 tints are 13 % mixes so `--node-fg` stays > 12:1.
- Focus: 2 px `--ring` outline, 2 px offset, on every interactive element (`:focus-visible`). Canvas nodes use the selection ring as their focus indicator.
- The map is a `role="tree"` with `role="treeitem"`, `aria-level`, `aria-expanded`, `aria-setsize/posinset`, roving tabindex (one tab stop for the whole map). The outline uses the same tree semantics. Visual map and outline share one accessibility tree so screen-reader users can work fully in either view.
- Typeahead: node input has `role="combobox"`, `aria-autocomplete="both"`, `aria-controls` the listbox, `aria-activedescendant` for the highlighted option.
- Colour is never the only signal: AI rows also have the sparkle; offline rows have a file icon and source; sync states have labels.
- Touch targets ≥ 44 × 44 on `sm`; outline rows 40 px with 2 px gaps.

---

## 13. Marketing site: brand

**Proposed mark: "Sprig".** A solid seed circle on the left with three curved shoots of unequal length fanning to the right, each ending in a small round bud; the highest bud is marigold (the highlighter, the idea that's being suggested), the rest ink blue. It reads as a mind map at 16 px and as a growing plant at 64 px. Strokes have round caps and slightly different curve tensions so it feels drawn, not constructed. Drawn as an SVG in `mockups.html` (`mark()`), 32 × 32 grid, stroke 2.6. Monochrome version: all ink. Favicon: seed + three buds without the shoots at 16 px.
If the working name changes, "Sprig" is also a candidate product name: short, ownable, and it describes the product (one idea branching).

Wordmark: the product name set in Onest 650, tracking −0.01em, never in the display face, so the mark carries the personality.

**Voice:** a calm, practical study partner. Short sentences, concrete verbs, keyboard names written as keys (Tab, Enter). No "supercharge", "unleash", "AI-powered". AI is described by what it does ("suggests the next branch").

**Hero headline options**
1. Every note is a list and a map. *(used in frame F)*
2. Write it as a list. See it as a map.
3. Tab to branch. Enter to keep going.
4. One idea, as many branches as it needs.

Sub-head (used): "Write an outline, flip it into a mind map, flip it back. Tab branches a thought, Enter continues it, and suggestions follow what the rest of your map is about." Fine print: "Free in your browser. Works offline. No account until you want sync."

**Colour usage on the site:** 90 % paper (`--background`, `--canvas` with dot grid for product stages), ink for type, ballpoint blue only for the primary CTA and links, marigold only where AI is shown in the product imagery. Branch colours appear only inside product imagery. Dark sections use the app's `.dark` tokens, not a separate palette.

**Layout:** left-aligned hero, headline in Bricolage Grotesque 84/0.98 at `wdth 92`; the hero image is the product itself on a dot-grid stage: an outline card and the same content as a map, joined by a dashed hand-drawn arrow, with the real segmented toggle on top. Below, three plain-text proof points (no cards): Keyboard first, Suggestions with context, Yours by default. On mobile the stage becomes a horizontally swipeable pair (outline, then map), headline 48 px.
