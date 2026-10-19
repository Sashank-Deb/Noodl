import type { ReactNode } from "react";
import { APP_LINKS, USE_CASES, type TemplateId } from "@/lib/site";
import { TEMPLATES } from "@/lib/templates";
import { FinalCta, PageHeader } from "./blocks";
import { MiniMap } from "./mini-map";

export function UseCasePage({
  path,
  name,
  title,
  lede,
  templateId,
  children,
}: {
  path: string;
  name: string;
  title: string;
  lede: string;
  templateId: TemplateId;
  children: ReactNode;
}) {
  const t = TEMPLATES.find((x) => x.id === templateId)!;
  const others = USE_CASES.filter((u) => u.href !== path);
  return (
    <>
      <PageHeader
        crumbs={[
          { name: "Use cases", path: "/use-cases/" },
          { name, path },
        ]}
        eyebrow={`For ${name.toLowerCase()}`}
        title={title}
        lede={lede}
      />
      <div className="container-site grid gap-12 pb-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
        <article className="prose-mn">{children}</article>
        <aside className="lg:pt-2" aria-label="Template for this use case">
          <div className="card lg:sticky lg:top-6">
            <div className="card-media canvas-surface">
              <MiniMap tree={t.tree} title={`${t.name} template as a mind map`} />
            </div>
            <div className="card-body">
              <h2 className="h3">{t.name} template</h2>
              <p className="muted text-[15px]">{t.summary}</p>
              <p className="pt-3">
                <a className="btn btn-primary btn-sm" href={APP_LINKS.template(t.id)}>
                  Open the {t.name.toLowerCase()} template
                </a>
              </p>
            </div>
          </div>
          <nav aria-label="Other use cases" className="mt-8">
            <h2 className="eyebrow">Other use cases</h2>
            <ul className="grid gap-1">
              {others.map((u) => (
                <li key={u.href}>
                  <a className="link" href={u.href}>
                    {u.label}
                  </a>
                  <span className="muted text-[15px]">: {u.blurb}</span>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
      <FinalCta />
    </>
  );
}
