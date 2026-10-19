import { FinalCta, Kbd, PageHeader } from "@/components/blocks";
import { MapWorld, OutlineCard, StageToggle } from "@/components/hero-stage";
import { TypeaheadDemo } from "@/components/typeahead-demo";
import { JsonLd, pageMetadata, softwareApplicationLd } from "@/lib/seo";
import { APP_LINKS } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Features",
  description:
    "Outline and mind map views of one note, typeahead suggestions on every node, AI map generation, summaries and rewrites, offline guest mode, Google sync, six export formats and a full keyboard shortcut list.",
  path: "/features/",
});

type Row = [keys: string[], action: string];

const GLOBAL: Row[] = [
  [["⌘", "K"], "Search notes and nodes, run commands"],
  [["⌥", "N"], "New note"],
  [["⌘", "⇧", "G"], "Generate a map with AI"],
  [["⌘", "⇧", "M"], "Switch between outline and mind map"],
  [["⌘", "\\"], "Show or hide the sidebar"],
  [["⌘", "."], "Focus mode (hide sidebar and toolbars)"],
  [["⌘", "⇧", "E"], "Export menu"],
  [["⌘", "Z"], "Undo (⌘⇧Z to redo)"],
  [["?"], "Show all shortcuts"],
];

const SELECT: Row[] = [
  [["Tab"], "Add a child and start typing in it"],
  [["Enter"], "Add a sibling below"],
  [["⇧", "Enter"], "Add a sibling above"],
  [["Space"], "Edit the selected node (F2 also works)"],
  [["↑", "↓"], "Previous or next node"],
  [["←", "→"], "Parent or first child (outline: collapse or expand first)"],
  [["⌥", "↑"], "Move the node up among its siblings (⌥↓ moves it down)"],
  [["⇧", "Tab"], "Outdent"],
  [["⌘", ";"], "Collapse or expand"],
  [["⌥", "1"], "Show the map to level 1 (⌥2, ⌥3; ⌥0 shows all)"],
  [["⌘", "J"], "Rewrite with AI"],
  [["⌘", "D"], "Duplicate the branch"],
  [["Delete"], "Delete the node and its branch (with Undo)"],
  [["⇧", "1"], "Fit the whole map in view"],
];

const EDIT: Row[] = [
  [["Tab"], "Accept the ghost text if it is showing, otherwise add a child"],
  [["→"], "Accept the ghost text (caret at end of text)"],
  [["⌥", "→"], "Accept the next word of the ghost text"],
  [["↑", "↓"], "Choose another suggestion"],
  [["Enter"], "Insert the chosen suggestion, or commit and add a sibling"],
  [["⇧", "Enter"], "New line inside the node"],
  [["Esc"], "Dismiss suggestions; press again to stop editing"],
  [["⌘", "B"], "Bold (⌘I for italic)"],
  [["⌘", "L"], "Turn the selected text into a link"],
];

function KeyTable({ caption, rows, id }: { caption: string; rows: Row[]; id: string }) {
  return (
    <div className="table-wrap">
      <table className="ktable" aria-labelledby={id}>
        <caption id={id}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Keys</th>
            <th scope="col">What it does</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([keys, action]) => (
            <tr key={action}>
              <td>
                <span className="keys">
                  {keys.map((k) => (
                    <Kbd key={k} ai={k === "Tab" && id === "keys-edit"}>
                      {k}
                    </Kbd>
                  ))}
                </span>
              </td>
              <td>{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const EXPORTS: [string, string, string][] = [
  ["PNG", "Image of the map", "1×, 2× or 3× scale; canvas, white or transparent background."],
  ["JPEG", "Image of the map", "1×, 2× or 3× scale; smaller files for chat and email."],
  ["PDF", "Document", "Fit the map to one page, or tile it across A4 pages for printing."],
  ["Markdown", "Document", "A nested bullet list. Opens in any editor and imports back in."],
  ["HTML", "Document", "A self-contained page you can open in a browser or attach to an email."],
  ["JSON", "Data", "Lossless and versioned: every node, style and setting. Ideal for backups."],
];

const AI_TOOLS: { title: string; body: string; how: string }[] = [
  {
    title: "Generate a map from a prompt",
    body: "Describe a topic, choose a depth (2, 3 or 4 levels) and how many main branches you want. The draft streams in as an outline you can read before you keep it.",
    how: "⌘⇧G, or the Generate button in the sidebar",
  },
  {
    title: "Summarize pasted text into a map",
    body: "Paste an article, transcript or notes (up to 20,000 characters). You get a new note titled from the text, organised into main points and details.",
    how: "Generate › Summarize pasted text",
  },
  {
    title: "Rewrite a node",
    body: "Make it shorter, fix spelling and grammar, turn it into a question, expand it into children, or give your own instruction. You see the old and new text side by side and choose Replace, Insert below or Discard.",
    how: "⌘J on a selected node",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <JsonLd data={softwareApplicationLd()} />
      <PageHeader
        crumbs={[{ name: "Features", path: "/features/" }]}
        eyebrow="Features"
        title="Everything a note needs, nothing it doesn't."
        lede="MindNote Web is an outliner and a mind map in one. It runs in your browser, works offline, and keeps your notes on your device unless you choose to sync."
      />

      <nav aria-label="On this page" className="container-site">
        <ul className="flex flex-wrap gap-2 text-[15px]">
          {[
            ["#views", "Two views"],
            ["#typeahead", "Typeahead"],
            ["#ai", "AI tools"],
            ["#offline", "Offline and sync"],
            ["#export", "Export and import"],
            ["#organise", "Organise"],
            ["#shortcuts", "Shortcuts"],
          ].map(([href, label]) => (
            <li key={href}>
              <a className="btn btn-outline btn-sm" href={href}>
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section id="views" className="section container-site" aria-labelledby="views-h">
        <div className="split">
          <div>
            <h2 id="views-h" className="h2">
              One tree, two shapes
            </h2>
            <div className="prose-mn mt-6">
              <p>
                Every note is a single tree of nodes. The outline shows it as an indented list; the mind map shows the
                same nodes as branches. Switching with <Kbd>⌘</Kbd> <Kbd>⇧</Kbd> <Kbd>M</Kbd> never reloads the note
                or loses your selection.
              </p>
              <ul>
                <li>Each first-level branch gets its own colour, and its children inherit it in both views.</li>
                <li>Drag nodes to reorder or re-parent them. In the outline, horizontal position picks the depth.</li>
                <li>Collapse any branch, or expand the whole map to a level with ⌥1, ⌥2, ⌥3 and ⌥0.</li>
                <li>
                  Five map styles: Ballpoint (default), Index card, Monochrome for printing, Highlighter, and an opt-in
                  hand-drawn Sketch style.
                </li>
                <li>Nodes can hold text, links, images or small tables.</li>
                <li>Right-side or balanced layout; double-click the canvas to reset the zoom and centre the root.</li>
              </ul>
            </div>
          </div>
          <div className="stage canvas-surface relative grid place-items-center gap-6 px-4 pt-20 pb-8" aria-hidden="true">
            <div className="absolute top-4 left-1/2 -translate-x-1/2">
              <StageToggle active="outline" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6">
              <OutlineCard editing />
              <MapWorld />
            </div>
          </div>
        </div>
      </section>

      <section id="typeahead" className="section rule-top container-site" aria-labelledby="ta-h">
        <div className="split split-rev">
          <div>
            <h2 id="ta-h" className="h2">
              Typeahead on every node
            </h2>
            <div className="prose-mn mt-6">
              <p>
                Start typing in any node, in either view. After a short pause the most likely ending appears as ghost
                text, with a marigold <Kbd ai>Tab</Kbd> chip to show that Tab will accept it. A dropdown offers up to
                five alternatives.
              </p>
              <ul>
                <li>
                  <strong>Context-aware.</strong> Suggestions use the path from the root (the note title) to your
                  node and the node&apos;s siblings. Never your other notes.
                </li>
                <li>
                  <strong>Never in the way.</strong> Typing is never blocked, late answers that no longer match are
                  dropped, and Esc hides suggestions until you change the text.
                </li>
                <li>
                  <strong>Offline fallback.</strong> Without a connection, or with AI off, you get fuzzy matches from
                  node text across your own notes, each labelled with its source note.
                </li>
                <li>
                  <strong>Adjustable.</strong> Change the suggestion delay (150–600 ms), stop Tab from accepting (→
                  still works), or switch typeahead off.
                </li>
                <li>
                  <strong>On phones</strong>, suggestions appear as chips above the keyboard; tap one to use it.
                </li>
              </ul>
            </div>
          </div>
          <TypeaheadDemo />
        </div>
      </section>

      <section id="ai" className="section rule-top container-site" aria-labelledby="ai-h">
        <h2 id="ai-h" className="h2 max-w-[20ch]">
          AI that drafts, then waits for you
        </h2>
        <p className="lede mt-6 max-w-[60ch]">
          AI features use Google Gemini through Firebase. Anything AI produces is shown in marigold as a preview, and
          nothing is written into a note until you accept it. Every AI change takes a snapshot first, so you can go
          back.
        </p>
        <ul className="grid-cards grid-cards-3 mt-10">
          {AI_TOOLS.map((t) => (
            <li key={t.title} className="card">
              <div className="card-body">
                <h3 className="h3">{t.title}</h3>
                <p className="muted text-[15px] leading-relaxed">{t.body}</p>
                <p className="mt-auto pt-4 text-[14px] font-medium" style={{ color: "var(--ai-strong)" }}>
                  {t.how}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-8">
          <a className="link" href={APP_LINKS.generate}>
            Try generating a map from a prompt
          </a>
        </p>
      </section>

      <section id="offline" className="section rule-top container-site" aria-labelledby="off-h">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 id="off-h" className="h2">
              Offline first, sync when you want it
            </h2>
          </div>
          <div className="prose-mn">
            <p>
              <strong>Guest mode is the whole app.</strong> There is no sign-up screen. Notes are saved in your
              browser&apos;s IndexedDB as you type, and the app keeps working without a connection.
            </p>
            <p>
              <strong>Sign in with Google to sync.</strong> Your notes are then stored in Google Firestore under your
              account and stay in step across devices. Notes you made as a guest are merged into your account. A status
              chip always tells you which state you are in: Local only, Synced, Syncing, Offline, or Needs review.
            </p>
            <p>
              <strong>Conflicts are shown, not hidden.</strong> If the same note changed on two devices, you see both
              versions side by side and keep one, the other, or both.
            </p>
            <p>
              <strong>Safety nets.</strong> Deleted notes stay in the Recycle Bin for 30 days. Each note keeps its last
              20 snapshots on the device, taken as you edit and before any AI change, and you can restore any of them.
            </p>
          </div>
        </div>
      </section>

      <section id="export" className="section rule-top container-site" aria-labelledby="ex-h">
        <h2 id="ex-h" className="h2">
          Export and import
        </h2>
        <p className="lede mt-6 max-w-[60ch]">
          Six formats from the Export menu (<Kbd>⌘</Kbd> <Kbd>⇧</Kbd> <Kbd>E</Kbd>). Map exports use your current map
          style and theme. Import Markdown outlines or MindNote JSON, or drop a .md or .json file onto the window.
        </p>
        <div className="table-wrap mt-10">
          <table className="ktable">
            <caption className="sr-only">Export formats</caption>
            <thead>
              <tr>
                <th scope="col">Format</th>
                <th scope="col">Type</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {EXPORTS.map(([f, type, d]) => (
                <tr key={f}>
                  <th scope="row">{f}</th>
                  <td className="muted whitespace-nowrap">{type}</td>
                  <td>{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted mt-4 text-[15px]">
          Settings › Data › Export all downloads every note as JSON in one zip file.
        </p>
      </section>

      <section id="organise" className="section rule-top container-site" aria-labelledby="org-h">
        <h2 id="org-h" className="h2">
          Organise and find
        </h2>
        <ul className="grid-cards grid-cards-3 mt-10">
          {[
            [
              "Search everything",
              "⌘K searches note titles and the text inside every node, shows where each match lives, and jumps straight to it.",
            ],
            ["Folders", "Group notes into folders (two levels), drag notes between them, and rename or move from the row menu."],
            [
              "Templates",
              "Start from Blank, Project plan, Lecture notes, Meeting notes, SWOT analysis or Story outline.",
            ],
            ["Light and dark", "Follows your system theme, or pick one. Both meet WCAG AA contrast."],
            [
              "Accessible",
              "Full keyboard control, visible focus, screen-reader tree semantics in both views, and reduced motion.",
            ],
            ["Any screen", "Phone, tablet and desktop layouts, with 44 px touch targets and a keyboard accessory bar on phones."],
          ].map(([t, d]) => (
            <li key={t} className="card">
              <div className="card-body">
                <h3 className="h3">{t}</h3>
                <p className="muted text-[15px] leading-relaxed">{d}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-8">
          <a className="link" href="/templates/">
            Browse the six templates
          </a>
        </p>
      </section>

      <section id="shortcuts" className="section rule-top container-site" aria-labelledby="sc-h">
        <h2 id="sc-h" className="h2">
          Keyboard shortcuts
        </h2>
        <p className="lede mt-6 max-w-[62ch]">
          Two modes: <strong className="text-foreground">select</strong> (a node is highlighted) and{" "}
          <strong className="text-foreground">edit</strong> (you are typing in it). ⌘ is Ctrl on Windows and Linux.
          Press ? in the app for the full list.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <KeyTable id="keys-global" caption="Anywhere" rows={GLOBAL} />
          <KeyTable id="keys-edit" caption="While editing a node" rows={EDIT} />
          <div className="lg:col-span-2">
            <KeyTable id="keys-select" caption="With a node selected" rows={SELECT} />
          </div>
        </div>
      </section>

      <FinalCta title="See it with your own notes." />
    </>
  );
}
