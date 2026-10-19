import { APP_LINKS, NAV_LINKS } from "@/lib/site";
import { MenuIcon } from "./icons";
import { Mark } from "./mark";

/**
 * Plain <a> links on purpose: the site ships no client router (see
 * scripts/strip-js.mjs), so every navigation is a fast static page load.
 * The mobile menu is a native <details> element, so it needs no JS.
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container-site site-nav">
        <a className="site-brand" href="/">
          <Mark size={30} />
          <span>MindNote Web</span>
        </a>
        <nav aria-label="Main" className="site-links">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <a className="btn btn-outline btn-sm nav-cta" href={APP_LINKS.home}>
          Open the app
        </a>
        <details className="mobile-menu">
          <summary aria-label="Menu">
            <MenuIcon size={22} />
          </summary>
          <nav aria-label="Main" className="mobile-panel">
            <ul>
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href}>{l.label}</a>
                </li>
              ))}
              <li className="p-1.5 pt-2">
                <a className="btn btn-primary w-full" href={APP_LINKS.newNote}>
                  Start a note
                </a>
              </li>
            </ul>
          </nav>
        </details>
      </div>
    </header>
  );
}
