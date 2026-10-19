import { Kbd } from "@/components/blocks";
import { MiniMap } from "@/components/mini-map";
import { PostLayout } from "@/components/post-layout";
import { getPost, postPath } from "@/lib/posts";
import { pageMetadata } from "@/lib/seo";
import { APP_LINKS } from "@/lib/site";
import type { TreeNode } from "@/lib/templates";

const post = getPost("outline-or-mind-map");

export const metadata = pageMetadata({
  title: post.seoTitle ?? post.title,
  description: post.description,
  path: postPath(post.slug),
  type: "article",
  publishedTime: post.date,
});

const TRIP: TreeNode = {
  text: "Lisbon trip",
  children: [
    { text: "Getting there", children: [{ text: "Flights" }, { text: "Airport metro" }] },
    { text: "Stay", children: [{ text: "Alfama" }] },
    { text: "Days", children: [{ text: "Belém" }, { text: "Sintra" }, { text: "LX Factory" }, { text: "Tram 28" }] },
    { text: "Budget" },
  ],
};

export default function Post() {
  return (
    <PostLayout post={post}>
      <p>
        There are two common ways to put structure on an idea. An <strong>outline</strong> is an indented list: one
        line per point, children tucked under parents. A <strong>mind map</strong> is the same tree drawn out, with the
        topic in the middle and branches growing from it.
      </p>
      <p>
        People tend to pick a side. We think that is the wrong question, because the two are good at different moments
        of the same piece of work.
      </p>

      <h2>Outlines are for getting it down</h2>
      <p>
        An outline asks almost nothing of you. You type a line, press Enter, type the next. When a thought belongs
        under the previous one, press Tab. Order is preserved, the text reads top to bottom, and nothing about layout
        needs a decision. That is why outlines are the fastest way to capture a lecture, a meeting or a first brain
        dump.
      </p>
      <p>
        They are weaker at showing <em>shape</em>. In a long outline, a section with twenty children and a section with
        one look much the same until you scroll. Relationships between distant branches are invisible.
      </p>

      <h2>Mind maps are for seeing it</h2>
      <p>
        A map trades reading order for overview. Each first-level branch gets its own colour and its own region, so
        balance is obvious at a glance: here is the branch with everything in it, here is the one you forgot.
      </p>
      <figure className="stage canvas-surface grid place-items-center p-6">
        <MiniMap
          tree={TRIP}
          title="A Lisbon trip note as a mind map. The Days branch has four children; Budget has none."
        />
        <figcaption className="muted mt-3 text-center text-[14px]">
          The same trip note as a map: Days is full, Budget is empty. In the outline that gap was easy to miss.
        </figcaption>
      </figure>
      <p>
        Maps are weaker for writing. Placing each node by hand is slow, and long sentences make a cluttered picture.
        Most people who “hate mind maps” have tried to <em>write</em> in one.
      </p>

      <h2>One note, two views</h2>
      <p>
        So noodl doesn&apos;t make you choose. A note is a single tree of nodes, and the outline and the map
        are two ways of looking at it. They are not an import and an export: when you edit in one, the other is already
        up to date, and switching (<Kbd>⌘</Kbd> <Kbd>⇧</Kbd> <Kbd>M</Kbd>, or Ctrl Shift M) keeps your selection and
        your caret where they were.
      </p>
      <p>The keys are the same in both. That is what makes switching cheap:</p>
      <ul>
        <li>
          <Kbd>Enter</Kbd> adds the next idea at the same level.
        </li>
        <li>
          <Kbd>Tab</Kbd> makes it a child; <Kbd>⇧ Tab</Kbd> moves it back out.
        </li>
        <li>
          <Kbd>Space</Kbd> edits the selected node; the arrow keys move between nodes.
        </li>
      </ul>

      <h2>A routine that works</h2>
      <ol>
        <li>
          <strong>Capture in the outline.</strong> Don&apos;t organise yet. One idea per line, Tab when something
          obviously belongs under something else.
        </li>
        <li>
          <strong>Flip to the map and look.</strong> Which branches are heavy? Which are empty? Is there a node that
          belongs in a different branch? Drag it there; its children come with it.
        </li>
        <li>
          <strong>Zoom out by level.</strong> <Kbd>⌥1</Kbd> shows only the main branches. If those don&apos;t tell
          the story on their own, rename them until they do.
        </li>
        <li>
          <strong>Go back to the outline to write.</strong> Fill the gaps you found, in order, at typing speed.
        </li>
      </ol>
      <p>
        Two or three passes like this usually turn a pile of notes into something you could hand to someone else.
      </p>

      <h2>When to stay in one view</h2>
      <p>
        Not every note needs both. A packing list is happy as a list. A brainstorm with a dozen loose ideas may never
        leave the map. The point isn&apos;t to use both every time, it is that you never have to copy a note from one
        tool into another to change how you see it.
      </p>
      <p>
        <a href={APP_LINKS.newNote}>Start a note</a> and try the routine on whatever is on your mind, or{" "}
        <a href="/templates/">pick a template</a> to begin with a shape.
      </p>
    </PostLayout>
  );
}
