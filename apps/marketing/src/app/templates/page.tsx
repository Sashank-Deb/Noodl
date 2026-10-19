import { FinalCta, PageHeader } from "@/components/blocks";
import { MiniMap } from "@/components/mini-map";
import { JsonLd, pageMetadata } from "@/lib/seo";
import { APP_LINKS, absoluteUrl } from "@/lib/site";
import { TEMPLATES, countNodes } from "@/lib/templates";

export const metadata = pageMetadata({
  title: "Templates",
  description:
    "Six free mind map templates: Blank, Project plan, Lecture notes, Meeting notes, SWOT analysis and Story outline. Open one in noodl and start typing.",
  path: "/templates/",
});

export default function TemplatesPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "noodl templates",
          itemListElement: TEMPLATES.map((t, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: t.name,
            url: absoluteUrl(APP_LINKS.template(t.id)),
          })),
        }}
      />
      <PageHeader
        crumbs={[{ name: "Templates", path: "/templates/" }]}
        eyebrow="Templates"
        title="Start from a shape that fits."
        lede="Each template is an ordinary note with a few branches already in place. Rename anything, delete what you don't need, and press Tab to grow it."
      />
      <section className="container-site pb-8" aria-label="All templates">
        <ul className="grid-cards grid-cards-3">
          {TEMPLATES.map((t) => (
            <li key={t.id} id={t.id} className="card">
              <div className="card-media canvas-surface">
                <MiniMap tree={t.tree} title={`${t.name} template as a mind map`} />
              </div>
              <div className="card-body">
                <h2 className="h3">{t.name}</h2>
                <p className="text-[15px]">{t.summary}</p>
                <p className="muted text-[15px] leading-relaxed">{t.goodFor}</p>
                <p className="muted text-[13.5px]">{countNodes(t.tree)} {countNodes(t.tree) === 1 ? "node" : "nodes"}</p>
                <p className="mt-auto pt-4">
                  <a className="btn btn-outline btn-sm" href={APP_LINKS.template(t.id)}>
                    Use template<span className="sr-only">: {t.name}</span>
                  </a>
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="prose-mn mt-14">
          <h2>Make your own</h2>
          <p>
            Any note can be a template: build the structure once, then duplicate it with <strong>⌘D</strong> on the
            root or <strong>Duplicate</strong> from the note menu. Prefer a list? Paste an indented Markdown outline and
            it becomes a map with the same structure.
          </p>
        </div>
      </section>
      <FinalCta title="Or start blank." body="One central topic, an empty canvas, and Tab to branch." />
    </>
  );
}
