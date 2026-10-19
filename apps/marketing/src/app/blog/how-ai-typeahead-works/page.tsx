import { Kbd } from "@/components/blocks";
import { PostLayout } from "@/components/post-layout";
import { TypeaheadDemo } from "@/components/typeahead-demo";
import { getPost, postPath } from "@/lib/posts";
import { pageMetadata } from "@/lib/seo";

const post = getPost("how-ai-typeahead-works");

export const metadata = pageMetadata({
  title: post.seoTitle ?? post.title,
  description: post.description,
  path: postPath(post.slug),
  type: "article",
  publishedTime: post.date,
});

export default function Post() {
  return (
    <PostLayout post={post}>
      <p>
        Every node in noodl, in both the outline and the mind map, can suggest how to finish what you are
        typing. This post explains what you see, which keys do what, and, because it matters, exactly what text is
        sent to Google and when.
      </p>

      <h2>What you see</h2>
      <p>
        Type at least two characters into a node and pause. The most likely ending appears after your caret in grey:
        that is <strong>ghost text</strong>. Next to it is a small marigold <Kbd ai>Tab</Kbd> chip. Below the node, a
        dropdown lists up to five suggestions. Suggestions made by the AI come first; matches from your own notes fill
        the rest and are marked with a file icon and the note they came from.
      </p>
      <TypeaheadDemo />
      <p>
        Marigold is reserved for AI throughout the app. If something is yellow, Gemini made it or is offering it. Your
        own words are never shown in that colour.
      </p>

      <h2>The keys</h2>
      <div className="table-wrap">
        <table className="ktable">
          <caption className="sr-only">Keys while a suggestion is showing</caption>
          <thead>
            <tr>
              <th scope="col">Key</th>
              <th scope="col">What it does</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Kbd ai>Tab</Kbd>
              </td>
              <td>Accepts the ghost text. With no ghost text showing, Tab adds a child node as usual.</td>
            </tr>
            <tr>
              <td>
                <span className="keys">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                </span>
              </td>
              <td>Moves through the dropdown.</td>
            </tr>
            <tr>
              <td>
                <Kbd>Enter</Kbd>
              </td>
              <td>Uses the suggestion you picked with the arrows. Otherwise it commits the node and adds a sibling.</td>
            </tr>
            <tr>
              <td>
                <Kbd>Esc</Kbd>
              </td>
              <td>Hides suggestions until you change the text. A second Esc stops editing.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Why Tab, when Tab already means “add a child”?</h3>
      <p>
        Because Tab is where your hand already is. The conflict is resolved by one rule: Tab accepts only while ghost
        text is visibly on screen, and the Tab chip makes that state explicit. After accepting, the ghost disappears,
        so the next Tab branches as normal. In practice it reads as one rhythm: <em>Tab accepts, Tab again
        branches.</em> Screen readers announce each suggestion and that Tab accepts it.
      </p>

      <h2>How a suggestion is made</h2>
      <ol>
        <li>
          <strong>Local first.</strong> As you type, the app looks for phrases you have already written in any of your
          notes that start with the same letters. This runs on your device, instantly, and costs nothing.
        </li>
        <li>
          <strong>Wait for a pause.</strong> The AI is only asked once you stop typing for a moment (about a third of a
          second), so a fast typist doesn&apos;t send a request per keystroke.
        </li>
        <li>
          <strong>Ask Gemini with context.</strong> The request includes where the node sits in the tree, so the same
          letters finish differently under <em>Fixes</em> than under <em>Budget</em>. It asks for full node texts that
          start with exactly what you typed and that don&apos;t repeat a sibling.
        </li>
        <li>
          <strong>Cancel stale work.</strong> Every new keystroke cancels the request in flight. An answer that arrives
          for text you have already changed is thrown away.
        </li>
        <li>
          <strong>Remember.</strong> Results are cached, so deleting back to something you typed a moment ago shows the
          same suggestions without asking again.
        </li>
      </ol>
      <p>
        Typing is never blocked. If the AI is slow, you keep typing and the local matches stay visible.
      </p>

      <h2>Exactly what is sent</h2>
      <p>
        Only when you are signed in with AI switched on, and only when the app decides to ask, one request goes from
        your browser to a small noodl function, which checks your session and passes it on to Google Gemini. For a
        typeahead suggestion it contains:
      </p>
      <ul>
        <li>what you have typed in the current node so far;</li>
        <li>
          the texts of the nodes from the root (the note&apos;s title) down to this node&apos;s parent, for example{" "}
          <em>Heat islands › Fixes</em>;
        </li>
        <li>the texts of the node&apos;s siblings;</li>
        <li>a fixed instruction asking for a short list of completions as JSON.</li>
      </ul>
      <p>
        Nothing else. Not the rest of the note, not your other notes, not your folders, not your account details. Here
        is a representative request for the example above:
      </p>
      <pre>
        <code>{`Mind map branch (root first):
- Heat islands
  - Fixes

Existing sibling nodes:
- Cool roofs
- Street trees

The user is typing a new node and has written: "Pocket par"
Give 4 suggestions for the full node text…`}</code>
      </pre>
      <p>
        The other AI features send what they need and no more: <strong>Generate</strong> sends your prompt,{" "}
        <strong>Summarize</strong> sends the text you pasted, and <strong>Rewrite</strong> sends the node, the path
        above it and your instruction.
      </p>

      <h2>Offline, AI off, or out of quota</h2>
      <p>
        Suggestions never just stop. They fall back to your own notes:
      </p>
      <ul>
        <li>
          <strong>Offline:</strong> the dropdown says so and shows only matches from your notes. No request is
          attempted.
        </li>
        <li>
          <strong>AI off</strong> in Settings › AI: the same local matches, and nothing is ever sent to Gemini.
        </li>
        <li>
          <strong>Rate-limited:</strong> if Google reports that the quota is used up, AI suggestions pause for about a
          minute while local matches carry on, then resume on their own.
        </li>
      </ul>
      <p>
        Local matches are often what you want anyway: names, places and terms you have used before come out spelled the
        same way every time.
      </p>

      <h2>The short version</h2>
      <p>
        Ghost text is a suggestion, never an edit. <Kbd ai>Tab</Kbd> takes it, typing ignores it, <Kbd>Esc</Kbd> hides
        it. With AI on, the node&apos;s path and siblings are sent to Gemini to make it smarter; with AI off, nothing
        leaves your device. The full details are in the <a href="/privacy/">privacy notice</a>.
      </p>
    </PostLayout>
  );
}
