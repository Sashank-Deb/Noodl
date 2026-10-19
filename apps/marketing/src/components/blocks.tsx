import type { ReactNode } from "react";
import { APP_LINKS } from "@/lib/site";
import { Breadcrumbs, type Crumb } from "./breadcrumbs";
import { SparkleIcon } from "./icons";

export function PageHeader({
  crumbs,
  eyebrow,
  title,
  lede,
  children,
}: {
  crumbs?: Crumb[];
  eyebrow?: string;
  title: string;
  lede?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="container-site pt-6 pb-10 md:pt-10 md:pb-14">
      {crumbs ? <Breadcrumbs items={crumbs} /> : null}
      <div className="mt-8 md:mt-12">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="display h1-page max-w-[18ch]">{title}</h1>
        {lede ? <p className="lede mt-6 max-w-[58ch]">{lede}</p> : null}
        {children}
      </div>
    </header>
  );
}

export function CtaButtons({ secondary = "generate" }: { secondary?: "generate" | "templates" | "none" }) {
  return (
    <div className="hero-cta">
      <a className="btn btn-primary btn-lg" href={APP_LINKS.newNote}>
        Start a note
      </a>
      {secondary === "generate" ? (
        <a className="btn btn-ghost btn-lg" href={APP_LINKS.generate}>
          <SparkleIcon size={17} className="ai-glyph" />
          Generate a map from a prompt
        </a>
      ) : secondary === "templates" ? (
        <a className="btn btn-ghost btn-lg" href="/templates/">
          Browse templates
        </a>
      ) : null}
    </div>
  );
}

export function FinalCta({
  title = "Start with one idea.",
  body = "Type a topic and press Tab to branch it. Everything stays on this device.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="container-site section" aria-labelledby="final-cta">
      <div className="stage canvas-surface px-6 py-14 text-center md:px-12 md:py-20">
        <h2 id="final-cta" className="h2 mx-auto max-w-[16ch]">
          {title}
        </h2>
        <p className="lede mx-auto mt-5">{body}</p>
        <div className="flex justify-center [&_.hero-cta]:justify-center">
          <CtaButtons secondary="templates" />
        </div>
        <p className="hero-fine">Free in your browser. Works offline. No account until you want sync.</p>
      </div>
    </section>
  );
}

export function Kbd({ children, ai = false, lg = false }: { children: ReactNode; ai?: boolean; lg?: boolean }) {
  return <kbd className={`kbd${ai ? " kbd-ai" : ""}${lg ? " kbd-lg" : ""}`}>{children}</kbd>;
}
