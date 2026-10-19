import { UseCasePage } from "@/components/use-case";
import { pageMetadata } from "@/lib/seo";
import { APP_LINKS } from "@/lib/site";

const PATH = "/use-cases/meeting-notes/";

export const metadata = pageMetadata({
  title: "Meeting notes with decisions and owners",
  description:
    "Run meetings from an outline: agenda in, decisions and action items out. Check coverage in the mind map, then export Markdown for your team. Free, offline, no sign-up.",
  path: PATH,
});

export default function MeetingNotesPage() {
  return (
    <UseCasePage
      path={PATH}
      name="Meeting notes"
      title="Agenda in. Decisions and owners out."
      lede="Most meeting notes fail the same way: a page of discussion and no record of who agreed to do what. A tree with a place for each fixes that while you type."
      templateId="meeting"
    >
      <h2>Before: put the agenda in the tree</h2>
      <p>
        Open the <strong>Meeting notes</strong> template. It has four branches: Attendees, Agenda, Decisions and Action
        items. Rename the root to the meeting and date, for example <em>“Design review, 14 Oct”</em>.
      </p>
      <p>
        If the agenda already exists as a list in an email or doc, copy it and paste it onto the Agenda node. Pasting
        multi-line text creates one node per line, and indentation becomes nesting, so a bulleted agenda arrives already
        structured.
      </p>

      <h2>During: one node per point</h2>
      <p>The keyboard flow is what makes live notes possible:</p>
      <ul>
        <li>
          Select an agenda item and press <strong>Tab</strong> to note what was said under it. <strong>Enter</strong>{" "}
          adds the next point at the same level.
        </li>
        <li>
          When something is agreed, write it as a decision in plain words: <em>“Ship the onboarding change behind a
          flag”</em>. Then move it to <em>Decisions</em> by dragging, or leave it where it is and tidy up afterwards.
        </li>
        <li>
          For actions, use one pattern every time: <em>who — what — when</em>. <em>“Priya — draft rollout email —
          Thu”</em> is searchable and easy to scan; <em>“email”</em> is not.
        </li>
      </ul>
      <p>
        Typeahead earns its keep in recurring meetings. Names of people, projects and systems you have typed before are
        suggested from your own notes, even offline, so they come out spelled the same way every week. With AI on,
        suggestions also follow the branch you are in: under <em>Action items</em> they look like tasks, under{" "}
        <em>Risks</em> they look like risks.
      </p>

      <h2>After: check the map, not the transcript</h2>
      <p>
        Switch to the mind map (<strong>⌘⇧M</strong>) and look at the shape. Every agenda item should lead somewhere:
        to a decision, an action, or an explicit <em>“parked”</em>. An item with a long tail of discussion and nothing
        else is the one to follow up on before people forget the context.
      </p>
      <p>
        Collapse the discussion with <strong>⌥1</strong> and the map shows only the four headings. Expand{" "}
        <em>Decisions</em> and <em>Action items</em> and you have the summary people actually read.
      </p>

      <h3>Summarising a transcript</h3>
      <p>
        If you have a transcript or a long chat thread, <strong>Generate › Summarize pasted text</strong> turns up to
        20,000 characters into a map you can edit. Read it against the source before sharing: summaries can miss a
        caveat or merge two decisions. The text is sent to Google Gemini, so check your company&apos;s policy and the
        participants&apos; expectations first. If in doubt, leave AI off; everything else works without it.
      </p>

      <h2>Share it where your team already works</h2>
      <ul>
        <li>
          <strong>Markdown</strong> pastes cleanly into issue trackers, wikis and chat. The tree becomes a nested list.
        </li>
        <li>
          <strong>HTML</strong> is a single file you can attach to an email or open in any browser.
        </li>
        <li>
          <strong>PDF</strong> or <strong>PNG</strong> of the map works for a quick visual recap in a slide or a
          message.
        </li>
      </ul>

      <h2>Recurring meetings</h2>
      <p>
        Duplicate last week&apos;s note from the note menu and delete what is done. Open actions carry over in their
        own branch, which makes the first agenda item obvious: <em>“Last week&apos;s actions”</em>.
      </p>
      <p>
        To find when something was decided, press <strong>⌘K</strong> and search. It matches the text inside every
        node, not just note titles, and shows the path to each result, such as <em>Design review, 14 Oct › Decisions</em>.
      </p>
      <p>
        If you take notes on a work laptop and read them on your phone, sign in with Google to sync. Otherwise the notes
        stay in the browser you wrote them in.
      </p>

      <p>
        <a href={APP_LINKS.template("meeting")}>Open the meeting notes template</a> before your next call.
      </p>
    </UseCasePage>
  );
}
