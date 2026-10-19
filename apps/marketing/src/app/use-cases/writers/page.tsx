import { UseCasePage } from "@/components/use-case";
import { pageMetadata } from "@/lib/seo";
import { APP_LINKS } from "@/lib/site";

const PATH = "/use-cases/writers/";

export const metadata = pageMetadata({
  title: "Story outlining for writers",
  description:
    "Plan a novel, short story or screenplay as one tree: characters, setting and three acts. Draft scene lists in the outline, check structure in the mind map, keep unpublished work on your device.",
  path: PATH,
});

export default function WritersPage() {
  return (
    <UseCasePage
      path={PATH}
      name="Writers"
      title="Plot, characters and scenes in one tree."
      lede="A story outline is a list when you are drafting and a map when you are restructuring. Keep one note and switch between the two as the book changes shape."
      templateId="novel"
    >
      <h2>Start with the skeleton</h2>
      <p>
        The <strong>Story outline</strong> template gives you six branches: Characters (with Protagonist and Antagonist
        under it), Setting, Act I — Setup, Act II — Confrontation, Act III — Resolution, and Themes. It is a starting
        shape, not a rule. Rename the acts, split Act II in two, or delete the whole structure and use chapters instead.
      </p>
      <p>
        If you already have notes in a text file, copy the indented list, select the root and press{" "}
        <strong>⌘V</strong>, or import the file as Markdown. Each line becomes a node and the indentation becomes the
        structure.
      </p>

      <h2>Draft scene lists in the outline</h2>
      <p>
        Under each act, add one node per scene and keep it to a sentence: who wants what, and what stops them.
        <strong> Tab</strong> under a scene holds beats or lines of dialogue you don&apos;t want to lose. When a scene
        belongs somewhere else, select it and press <strong>⌥↑</strong> or <strong>⌥↓</strong> to move it among its
        siblings, or drag it to another act. Its beats go with it.
      </p>
      <p>
        Characters work the same way. Give each character a node, and under it: what they want, what they are afraid
        of, and how they change. When you are drafting a scene and can&apos;t remember a minor character&apos;s
        surname, it is one search away (<strong>⌘K</strong> searches inside every node).
      </p>

      <h2>Check the structure in the map</h2>
      <p>
        Press <strong>⌘⇧M</strong> to see the story as a mind map. Each act gets its own colour, so imbalance is easy
        to spot: an Act I with fourteen scenes next to an Act III with three is visible at a glance, long before it
        shows up in a word count.
      </p>
      <ul>
        <li>
          <strong>⌥1</strong> shows only the acts and main branches: the story on one screen.
        </li>
        <li>
          <strong>⌥2</strong> adds scenes. Read them left to right and ask whether each one changes something.
        </li>
        <li>
          Collapse finished acts to keep the map readable while you work on the rest.
        </li>
      </ul>
      <p>
        Before a big restructure, you don&apos;t need to make a copy by hand. Each note keeps its last 20 snapshots on
        your device (taken when you open it and every five minutes while you work), and Version history restores any
        of them, in place or as a separate note to compare.
      </p>

      <h2>Use AI as a sparring partner, or not at all</h2>
      <p>
        Some writers want a second opinion on a stuck scene; many don&apos;t want AI anywhere near their draft. Both are
        supported.
      </p>
      <ul>
        <li>
          <strong>Expand into ideas</strong> (in the AI menu) adds a few possible next beats under a scene as child
          nodes. Keep one, rewrite it in your own voice, and delete the rest, or undo the lot.
        </li>
        <li>
          <strong>Rewrite › Make it a question</strong> turns a plot point into the dramatic question it raises, which
          is a useful check on whether a scene has stakes.
        </li>
        <li>
          <strong>AI off</strong> (Settings › AI) sends nothing to Gemini. Typeahead keeps
          working from your own notes, which is handy for invented names and places: they autocomplete with the
          spelling you chose.
        </li>
      </ul>
      <p>
        AI only acts when you ask: typeahead waits for Tab, and a rewrite or expansion happens only when you choose it
        from the menu. Every one can be undone, and a version snapshot is taken before it runs.
      </p>

      <h2>Unpublished work stays yours</h2>
      <p>
        In guest mode the outline exists only in your browser on this device. If you sign in to sync, it is stored in
        Google Firestore under your account. AI requests send only the text needed for that request, and only while AI
        is on. Details are in the <a href="/privacy/">privacy notice</a>.
      </p>

      <h2>From outline to manuscript</h2>
      <p>
        When you are ready to draft, export <strong>Markdown</strong>: the outline becomes a nested list, with acts at the
        top level and scenes beneath them, and it pastes into most writing tools. Export <strong>JSON</strong> as a
        full backup of the outline, and a <strong>PDF</strong> of the map to pin above your desk.
      </p>

      <p>
        <a href={APP_LINKS.template("novel")}>Open the story outline template</a> and give your book a skeleton.
      </p>
    </UseCasePage>
  );
}
