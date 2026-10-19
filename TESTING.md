# Manual testing checklist

Run it: double-click **Start noodl.command** (production build, http://localhost:4320/app/) or **Dev noodl.command** (hot reload, http://localhost:3000/app/). First time on macOS: right-click → Open, because the scripts aren't signed. Needs Node.js 22+ to build; serving an existing `dist/` also works with Python 3.

Without Firebase config the app runs in **local mode**: no sign-in, no sync, and typeahead suggests from your own notes (AI is hidden). To test AI/sync, fill `apps/app/.env.local` (see `.env.example`) and run Dev mode.

## Core editing (map view)
- [ ] First visit opens the "Welcome to noodl" note
- [ ] Click the root → Tab adds a child and starts editing; Enter adds a sibling; Esc stops editing
- [ ] Space / F2 / double-click edits; arrows move the selection; ⌥↑/⌥↓ reorder
- [ ] Delete removes a branch and the toast's Undo brings it back; ⌘Z / ⇧⌘Z
- [ ] Drag a node onto another to re-parent it
- [ ] Pan by dragging the canvas, ⌘/Ctrl + wheel or pinch to zoom, double-click the canvas to fit, ⇧1 fit
- [ ] L1 / L2 / L3 / All; collapse a node with its round button; ⌘;
- [ ] Map styles: Ballpoint, Elbow, Index card

## Typeahead
- [ ] Type in a new node a phrase you've used elsewhere (e.g. "Outline f") → ghost text + Tab chip; Tab accepts
- [ ] ↑/↓ then Enter picks another suggestion; Esc hides the list until you type again
- [ ] Tab with no ghost text adds a child

## Outline view
- [ ] ⇧⌘M or the toggle switches views without losing content
- [ ] Enter on the title creates the first branch; Tab indents, ⇧Tab outdents; Enter on an empty row outdents
- [ ] Drag the coloured dot to move a row before / after / inside another

## Library
- [ ] New note, rename (double-click), duplicate, move to folder (menu or drag onto folder), delete → Recycle Bin → restore
- [ ] Folders: create, rename, delete (notes move to All notes)
- [ ] ⌘K search finds notes and node text; Enter on a node result selects it
- [ ] Templates dialog creates a copy

## Data
- [ ] Export PNG, JPEG, PDF, Markdown, HTML, text, JSON; re-import the Markdown/JSON (also drag a file onto the window)
- [ ] Settings → Data → Export all / Restore
- [ ] ⋯ → Version history shows versions; restore and "restore as copy"
- [ ] Turn into → Link / Image / Table; edit table cells while editing the node
- [ ] Reload the page: everything is still there. Turn off Wi-Fi and reload (production build): the app still opens

## Other
- [ ] ⌘. focus mode, ? shortcut list, ⌘, settings, theme light/dark/system
- [ ] Phone width (devtools device mode): library opens as a sheet, map starts readable
- [ ] Marketing site at http://localhost:4320/ (or :3001 in dev): links to /app/ work

Report issues with the steps, expected and actual result, and a screenshot.
