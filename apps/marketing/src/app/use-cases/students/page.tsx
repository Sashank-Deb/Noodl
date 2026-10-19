import { UseCasePage } from "@/components/use-case";
import { pageMetadata } from "@/lib/seo";
import { APP_LINKS } from "@/lib/site";

const PATH = "/use-cases/students/";

export const metadata = pageMetadata({
  title: "Mind maps and outlines for students",
  description:
    "Take lecture notes as a fast outline, revise them as a mind map, and quiz yourself by collapsing branches. A practical study method using MindNote Web, free and offline.",
  path: PATH,
});

export default function StudentsPage() {
  return (
    <UseCasePage
      path={PATH}
      name="Students"
      title="Take notes as a list. Revise them as a map."
      lede="Lectures arrive in order; exams ask how things connect. One note that is both an outline and a mind map covers both jobs without copying anything out twice."
      templateId="lecture"
    >
      <h2>In the lecture: type, don&apos;t design</h2>
      <p>
        During a lecture, speed matters more than layout. Open the <strong>Lecture notes</strong> template and stay in
        the outline. It gives you five branches to aim for: Key concepts, Examples, Formulas &amp; definitions,
        Questions to review and Further reading. You don&apos;t have to fill them in order.
      </p>
      <ul>
        <li>
          <strong>Enter</strong> starts the next point at the same level. <strong>Tab</strong> tucks it under the
          point above. <strong>Shift Tab</strong> pulls it back out.
        </li>
        <li>
          Missed something? Type a placeholder like <em>“?? check slide 14”</em> under <em>Questions to review</em>{" "}
          and keep going. You will see it as its own branch later.
        </li>
        <li>
          Keep each node to one idea. Short nodes make a readable map, and they make better flashcards later.
        </li>
      </ul>
      <p>
        Typeahead helps here because it knows where you are. Under <em>Key concepts</em> in a note titled{" "}
        <em>Lecture 6: Thermodynamics</em>, typing <em>“Ent”</em> is far more likely to finish as{" "}
        <em>“Entropy”</em> than anything else. Press Tab to accept, or keep typing and it gets out of the way.
      </p>

      <h2>After class: flip to the map and look for gaps</h2>
      <p>
        Press <strong>⌘⇧M</strong> (Ctrl Shift M on Windows) to see the same note as a mind map. Thin branches stand
        out: a concept with no example, a formula with no definition, a whole section with one node under it. Those are
        the parts to fix while the lecture is still fresh.
      </p>
      <p>
        Drag nodes to where they belong. A point you wrote under Examples might really be a concept in its own right;
        drop it on <em>Key concepts</em> and it moves, with everything under it, in both views.
      </p>

      <h2>Revision: use the map to test yourself</h2>
      <p>
        Re-reading notes feels productive but doesn&apos;t stick. Retrieval does: trying to remember something before
        you look. A collapsible map is a good tool for that.
      </p>
      <ol>
        <li>
          Press <strong>⌥1</strong> to show only the first level. You see the headings and nothing else.
        </li>
        <li>For each branch, say or write what you think is underneath it.</li>
        <li>
          Expand that branch (<strong>⌘;</strong> on the selected node) and check. Anything you missed becomes a node
          under <em>Questions to review</em>.
        </li>
        <li>
          Repeat with <strong>⌥2</strong> for the next level down when the first is easy.
        </li>
      </ol>
      <p>
        With AI on, <strong>Rewrite › Make it a question</strong> (⌘J) turns a statement like{" "}
        <em>“Entropy of an isolated system never decreases”</em> into a prompt you can answer from memory. It shows you
        the new wording first; nothing changes until you choose Replace or Insert below.
      </p>

      <h2>Readings: summarise, then check</h2>
      <p>
        For a long article or chapter, <strong>Generate › Summarize pasted text</strong> turns up to 20,000 characters
        into a map of the main points. Treat it as a first draft: open the source next to it and correct anything that
        is wrong or missing. Checking a summary against the text is itself good revision, and the mistakes you catch
        are the ones you will remember.
      </p>
      <p>
        Pasted text is sent to Google Gemini to make the summary. If your course materials aren&apos;t yours to share,
        type your own outline instead, or switch AI off in Settings.
      </p>

      <h2>Exam week and group study</h2>
      <ul>
        <li>
          <strong>Print it.</strong> Export the map as PDF, fitted to one page or tiled across A4, or as a PNG for your
          phone&apos;s lock screen.
        </li>
        <li>
          <strong>Share it.</strong> Export Markdown and paste it into your group chat or shared doc. Anyone can import
          it back into a map.
        </li>
        <li>
          <strong>Library computers.</strong> Notes are saved in that browser. Before you leave, export JSON or sign in
          with Google so the note syncs to your account, then use Settings › Data to delete local data.
        </li>
        <li>
          <strong>No Wi-Fi.</strong> Once the app has loaded, everything keeps working offline, and suggestions come
          from your own notes, which is often exactly the vocabulary you need.
        </li>
      </ul>

      <p>
        <a href={APP_LINKS.template("lecture")}>Start a lecture note now</a>, or read{" "}
        <a href="/blog/outline-or-mind-map/">why we think you should use both views</a>.
      </p>
    </UseCasePage>
  );
}
