import { APP_LINKS, USE_CASES } from "@/lib/site";
import { Mark } from "./mark";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container-site footer-grid">
        <div className="col-span-2 md:col-span-1">
          <a className="site-brand" href="/">
            <Mark size={26} />
            <span>noodl</span>
          </a>
          <p className="muted mt-3 max-w-[34ch] text-[15px] leading-relaxed">
            Free in your browser. Works offline. No account until you want sync or AI.
          </p>
        </div>
        <div>
          <h2>Product</h2>
          <ul>
            <li>
              <a href="/features/">Features</a>
            </li>
            <li>
              <a href="/templates/">Templates</a>
            </li>
            <li>
              <a href={APP_LINKS.home}>Open the app</a>
            </li>
          </ul>
        </div>
        <div>
          <h2>Use cases</h2>
          <ul>
            {USE_CASES.map((u) => (
              <li key={u.href}>
                <a href={u.href}>{u.label}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Resources</h2>
          <ul>
            <li>
              <a href="/blog/">Blog</a>
            </li>
            <li>
              <a href="/privacy/">Privacy</a>
            </li>
            <li>
              <a href="/sitemap.xml">Sitemap</a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
