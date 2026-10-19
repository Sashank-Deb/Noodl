import type { Metadata } from "next";
import { APP_LINKS } from "@/lib/site";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This page doesn't exist. Head back to the noodl home page or open the app.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <section className="container-site section" aria-labelledby="nf">
      <p className="eyebrow">404</p>
      <h1 id="nf" className="display h1-page max-w-[16ch]">
        No branch grows here.
      </h1>
      <p className="lede mt-6">
        The page you were looking for doesn&apos;t exist, or it moved. Check the address, or pick up from one of these.
      </p>
      <div className="hero-cta">
        <a className="btn btn-primary btn-lg" href="/">
          Go to the home page
        </a>
        <a className="btn btn-outline btn-lg" href={APP_LINKS.home}>
          Open the app
        </a>
      </div>
      <ul className="mt-10 grid gap-2 text-[16px]">
        <li>
          <a className="link" href="/features/">See every feature</a>
        </li>
        <li>
          <a className="link" href="/templates/">Browse templates</a>
        </li>
        <li>
          <a className="link" href="/blog/">Read the blog</a>
        </li>
      </ul>
    </section>
  );
}
