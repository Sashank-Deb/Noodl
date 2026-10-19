import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { JsonLd, organizationLd, websiteLd } from "@/lib/seo";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

// Self-hosted fonts (no third-party requests). Both are preloaded: Onest is the
// body face, Bricolage renders the h1, which is the LCP element.
const onest = localFont({
  src: "../fonts/onest-latin-wght.woff2",
  weight: "400 700",
  variable: "--font-onest",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

// Bricolage Grotesque instanced at wdth 92 / opsz 96 (DESIGN.md §2), wght 600–800.
// See README "Fonts" for how the file was produced.
const bricolage = localFont({
  src: "../fonts/bricolage-grotesque-display.woff2",
  weight: "600 800",
  variable: "--font-bricolage",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME}: every note is a list and a map`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: "/",
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafcfe" },
    { media: "(prefers-color-scheme: dark)", color: "#12151a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${onest.variable} ${bricolage.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
        <JsonLd data={[organizationLd(), websiteLd()]} />
      </body>
    </html>
  );
}
