import { CtaButtons, FinalCta, Kbd } from "@/components/blocks";
import { HeroStage } from "@/components/hero-stage";
import { CheckIcon, CloudIcon, DriveIcon, ShieldIcon, SparkleIcon } from "@/components/icons";
import { MiniMap } from "@/components/mini-map";
import { TypeaheadDemo } from "@/components/typeahead-demo";
import { FAQ } from "@/lib/faq";
import { JsonLd, faqLd, pageMetadata, softwareApplicationLd } from "@/lib/seo";
import { APP_LINKS } from "@/lib/site";
import { TEMPLATES, countNodes, type TreeNode } from "@/lib/templates";

export const metadata = pageMetadata({
  title: "noodl: every note is a list and a map",
  absoluteTitle: true,
  description:
    "Write an outline, flip it into a mind map, flip it back. Free in your browser, works offline, no account until you want sync or AI. Suggestions on every node follow what your map is about.",
  path: "/",
});

const HEAT_ISLANDS: TreeNode = {
  text: "Heat islands",
  children: [
    { text: "Causes", children: [{ text: "Dark roofs" }, { text: "Lost trees" }] },
    { text: "Effects", children: [{ text: "Hotter nights" }] },
    { text: "Fixes", children: [{ text: "Cool roofs" }, { text: "Street trees" }, { text: "Pocket parks" }] },
  ],
};

const TEASER = TEMPLATES.filter((t) => ["lecture", "meeting", "novel"].includes(t.id));

export default function Home() {
  return (
    <>
      <JsonLd data={[softwareApplicationLd(), faqLd(FAQ)]} />

      {/* ---- Hero ------------------------------------------------------- */}
      <section className="hero container-site" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title" className="display h1-hero">
            Every note is a list and a map.
          </h1>
          <div className="hero-side">
            <p className="lede">
              Write an outline, flip it into a mind map, flip it back. Tab branches a thought, Enter continues it, and
              suggestions follow what the rest of your map is about.
            </p>
            <CtaButtons />
            <p className="hero-fine">Free in your browser. Works offline. No account until you want sync or AI.</p>
          </div>
        </div>
        <HeroStage />

        <div className="proof">
          <div>
            <h2>Keyboard first</h2>
            <p>Tab to branch, Enter for the next idea, Space to edit. Your hands stay on the keys.</p>
          </div>
          <div>
            <h2>Suggestions with context</h2>
            <p>Each node suggests completions from its parents and siblings, and falls back to your own notes offline.</p>
          </div>
          <div>
            <h2>Yours by default</h2>
            <p>Notes live on this device. Sign in with Google only when you want them on your other devices.</p>
          </div>
        </div>
      </section>

      {/* ---- How it works ---------------------------------------------- */}
      <section className="section container-site" aria-labelledby="how">
        <p className="eyebrow">How it works</p>
        <h2 id="how" className="h2 max-w-[20ch]">
          Three keys get you from a topic to a map.
        </h2>
        <ol className="steps mt-12">
          <li className="step">
            <span className="step-num">1</span>
            <h3 className="h3 mt-3">Type a topic, press Enter</h3>
            <p className="muted mt-2">
              Start with one idea. Enter commits it and opens the next line at the same level, so a list comes out as
              fast as you can type it.
            </p>
            <p className="keys mt-auto pt-5">
              <Kbd lg>Enter</Kbd>
            </p>
          </li>
          <li className="step">
            <span className="step-num">2</span>
            <h3 className="h3 mt-3">Tab to branch, Shift Tab to step back</h3>
            <p className="muted mt-2">
              Tab turns the next line into a child of the one above. Shift Tab moves it back out. Structure happens
              while you write, not afterwards.
            </p>
            <p className="keys mt-auto pt-5">
              <Kbd lg>Tab</Kbd>
              <Kbd lg>⇧ Tab</Kbd>
            </p>
          </li>
          <li className="step">
            <span className="step-num">3</span>
            <h3 className="h3 mt-3">Flip it into a mind map</h3>
            <p className="muted mt-2">
              The same note, laid out as branches with a colour each. Your selection and caret stay where they were.
              On Windows and Linux, use Ctrl for ⌘.
            </p>
            <p className="keys mt-auto pt-5">
              <Kbd lg>⌘</Kbd>
              <Kbd lg>⇧</Kbd>
              <Kbd lg>M</Kbd>
            </p>
          </li>
        </ol>
      </section>

      {/* ---- Outline <-> map ------------------------------------------- */}
      <section className="section rule-top container-site" aria-labelledby="two-views">
        <div className="split">
          <div>
            <p className="eyebrow">One tree, two shapes</p>
            <h2 id="two-views" className="h2">
              Write it as a list. See it as a map.
            </h2>
            <p className="lede mt-6">
              Outline and mind map are two views of the same nodes, not an import and an export. Edit in either one and
              the other is already up to date.
            </p>
            <ul className="checks">
              <li>
                <CheckIcon size={18} />
                <span>
                  <strong>Outline</strong> for fast writing: indent with Tab, reorder by dragging, collapse what you are
                  not working on.
                </span>
              </li>
              <li>
                <CheckIcon size={18} />
                <span>
                  <strong>Mind map</strong> for the big picture: each first-level branch gets its own colour, and every
                  child inherits it.
                </span>
              </li>
              <li>
                <CheckIcon size={18} />
                <span>
                  Expand the map by level with <Kbd>⌥1</Kbd> <Kbd>⌥2</Kbd> <Kbd>⌥3</Kbd>, or everything with{" "}
                  <Kbd>⌥0</Kbd>.
                </span>
              </li>
            </ul>
          </div>
          <div className="stage canvas-surface grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center md:p-10">
            <div aria-hidden="true">
              <OutlineMini />
            </div>
            <MiniMap
              tree={HEAT_ISLANDS}
              title="The Heat islands note as a mind map: Causes, Effects and Fixes branch from the root in blue, red and green."
              className="mx-auto"
              scale={1.6}
              maxHeight={320}
            />
          </div>
        </div>
      </section>

      {/* ---- AI typeahead ---------------------------------------------- */}
      <section className="section rule-top container-site" aria-labelledby="typeahead">
        <div className="split split-rev">
          <div>
            <p className="eyebrow">Typeahead on every node</p>
            <h2 id="typeahead" className="h2">
              It suggests the next branch. You decide.
            </h2>
            <p className="lede mt-6">
              While you type, the rest of the suggestion appears as grey ghost text. Nothing is written into your note
              until you press a key.
            </p>
            <ul className="checks">
              <li>
                <CheckIcon size={18} />
                <span>
                  <Kbd ai>Tab</Kbd> accepts the ghost text. Press Tab again and it adds a child, as usual: Tab accepts,
                  Tab again branches.
                </span>
              </li>
              <li>
                <CheckIcon size={18} />
                <span>
                  <Kbd>↑</Kbd> <Kbd>↓</Kbd> pick another suggestion, <Kbd>Enter</Kbd> inserts it, <Kbd>Esc</Kbd>{" "}
                  hides them until you change the text.
                </span>
              </li>
              <li>
                <CheckIcon size={18} />
                <span>
                  Suggestions come from the node&apos;s parents and siblings, so “Pocket par…” under <em>Fixes</em>{" "}
                  finishes differently than it would under <em>Budget</em>.
                </span>
              </li>
              <li>
                <CheckIcon size={18} />
                <span>
                  Offline, or with AI switched off, it falls back to phrases and words from your own notes,
                  labelled “From your notes”.
                </span>
              </li>
            </ul>
            <p className="mt-6 text-[15px]">
              <a className="link" href="/blog/how-ai-typeahead-works/">
                How typeahead works, and exactly what it sends
              </a>
            </p>
          </div>
          <TypeaheadDemo />
        </div>
      </section>

      {/* ---- Privacy / local first (uses the app's .dark tokens) -------- */}
      <section className="container-site section-tight" aria-labelledby="privacy">
        <div className="band dark">
          <p className="eyebrow">Local first</p>
          <h2 id="privacy" className="h2 max-w-[18ch]">
            Yours by default. Synced only if you ask.
          </h2>
          <div className="band-grid">
            <div>
              <h3 className="h3">
                <DriveIcon size={20} />
                Saved in this browser
              </h3>
              <p>Notes are stored in your browser&apos;s IndexedDB, on this device. Guest mode is the full app.</p>
            </div>
            <div>
              <h3 className="h3">
                <CloudIcon size={20} />
                Sync is opt-in
              </h3>
              <p>Sign in with Google to sync your notes under your account, and open them anywhere.</p>
            </div>
            <div>
              <h3 className="h3">
                <SparkleIcon size={20} />
                AI only when it&apos;s on
              </h3>
              <p>AI is for signed-in users. Prompts and nearby node text go to our AI provider (Groq, with Google Gemini as backup) only while AI is switched on.</p>
            </div>
            <div>
              <h3 className="h3">
                <ShieldIcon size={20} />
                No ads, no trackers
              </h3>
              <p>No advertising, no analytics scripts and no tracking cookies, on this site or in the app.</p>
            </div>
          </div>
          <p className="mt-10 text-[15px]">
            <a className="link" href="/privacy/">
              Read the privacy notice
            </a>
          </p>
        </div>
      </section>

      {/* ---- Templates teaser ----------------------------------------- */}
      <section className="section container-site" aria-labelledby="templates">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Templates</p>
            <h2 id="templates" className="h2 max-w-[18ch]">
              Start from a shape that fits.
            </h2>
          </div>
          <a className="btn btn-outline" href="/templates/">
            See all six templates
          </a>
        </div>
        <ul className="grid-cards grid-cards-3 mt-12">
          {TEASER.map((t) => (
            <li key={t.id} className="card">
              <div className="card-media canvas-surface">
                <MiniMap tree={t.tree} title={`${t.name} template as a mind map`} />
              </div>
              <div className="card-body">
                <h3 className="h3">{t.name}</h3>
                <p className="muted text-[15px]">
                  {t.summary} {countNodes(t.tree)} nodes.
                </p>
                <p className="mt-auto pt-3">
                  <a className="link font-medium" href={APP_LINKS.template(t.id)}>
                    Use the {t.name.toLowerCase()} template
                  </a>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- FAQ -------------------------------------------------------- */}
      <section className="section rule-top container-site" aria-labelledby="faq">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <div>
            <p className="eyebrow">FAQ</p>
            <h2 id="faq" className="h2">
              Questions, answered plainly.
            </h2>
          </div>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p className="answer">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <FinalCta />
    </>
  );
}

function OutlineMini() {
  const rows: [string, number, number?][] = [
    ["Causes", 1, 1],
    ["Dark roofs", 2],
    ["Lost trees", 2],
    ["Effects", 1, 2],
    ["Hotter nights", 2],
    ["Fixes", 1, 3],
    ["Cool roofs", 2],
    ["Street trees", 2],
    ["Pocket parks", 2],
  ];
  return (
    <div className="outline-card" style={{ width: 200 }}>
      <div className="ho-title">Heat islands</div>
      {rows.map(([t, depth, branch]) => (
        <div key={t} className={`ho-row${depth === 2 ? " ho-2" : ""}`}>
          {branch ? <i className="dot" style={{ background: `var(--branch-${branch})` }} /> : null}
          {t}
        </div>
      ))}
    </div>
  );
}
