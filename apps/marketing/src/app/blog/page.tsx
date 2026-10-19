import { PageHeader } from "@/components/blocks";
import { POSTS, formatDate, postPath } from "@/lib/posts";
import { JsonLd, ORG_ID, pageMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Blog",
  description:
    "Notes on outlining, mind mapping and how noodl works, including exactly what the AI typeahead sends and when.",
  path: "/blog/",
});

export default function BlogIndex() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "noodl blog",
          url: absoluteUrl("/blog/"),
          publisher: { "@id": ORG_ID },
          blogPost: POSTS.map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            url: absoluteUrl(postPath(p.slug)),
            datePublished: p.date,
          })),
        }}
      />
      <PageHeader
        crumbs={[{ name: "Blog", path: "/blog/" }]}
        eyebrow="Blog"
        title="Notes on notes."
        lede="How we think about outlines and maps, and plain explanations of how noodl works."
      />
      <section className="container-site pb-20" aria-label="Posts">
        <ul className="grid gap-4">
          {POSTS.map((p) => (
            <li key={p.slug}>
              <a className="card card-link" href={postPath(p.slug)}>
                <div className="card-body md:flex-row md:items-baseline md:gap-10">
                  <p className="muted shrink-0 text-[14px] md:w-40">
                    <time dateTime={p.date}>{formatDate(p.date)}</time>
                  </p>
                  <div>
                    <h2 className="h3 text-[20px]">{p.title}</h2>
                    <p className="muted mt-2 max-w-[70ch] text-[15px] leading-relaxed">{p.description}</p>
                    <p className="text-primary mt-3 text-[15px] font-medium">Read the post · {p.readingMinutes} min</p>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
