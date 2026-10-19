import { JsonLd, breadcrumbLd } from "@/lib/seo";

export type Crumb = { name: string; path: string };

/** Visible breadcrumb trail + BreadcrumbList JSON-LD. Last item is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all = [{ name: "Home", path: "/" }, ...items];
  return (
    <nav aria-label="Breadcrumb" className="crumbs">
      <JsonLd data={breadcrumbLd(all)} />
      <ol>
        {all.map((c, i) => (
          <li key={c.path}>
            {i === all.length - 1 ? (
              <span aria-current="page" className="text-foreground">
                {c.name}
              </span>
            ) : (
              <a href={c.path}>{c.name}</a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
