import { FinalCta, PageHeader } from "@/components/blocks";
import { ArrowRightIcon } from "@/components/icons";
import { pageMetadata } from "@/lib/seo";
import { USE_CASES } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Use cases",
  description:
    "How students, people running meetings and writers use MindNote Web: outlines for capture, mind maps for review, and typeahead that knows the rest of the note.",
  path: "/use-cases/",
});

export default function UseCasesPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ name: "Use cases", path: "/use-cases/" }]}
        eyebrow="Use cases"
        title="Capture as a list. Think as a map."
        lede="Three ways people use one note in two shapes. Each guide is a working method you can copy, with the keys to press."
      />
      <section className="container-site pb-8" aria-label="Guides">
        <ul className="grid-cards grid-cards-3">
          {USE_CASES.map((u) => (
            <li key={u.href}>
              <a className="card card-link h-full" href={u.href}>
                <div className="card-body">
                  <h2 className="h3">{u.label}</h2>
                  <p className="muted text-[15px]">{u.blurb}</p>
                  <p className="text-primary mt-auto inline-flex items-center gap-1.5 pt-4 text-[15px] font-medium">
                    Read the guide <ArrowRightIcon size={16} />
                  </p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <FinalCta />
    </>
  );
}
