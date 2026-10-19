import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";

// Self-hosted (no request to Google Fonts at runtime).
const onest = localFont({
  src: [
    { path: "../../node_modules/@fontsource-variable/onest/files/onest-latin-wght-normal.woff2", weight: "100 900" },
  ],
  variable: "--font-onest",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MindNote Web — mind maps and outline notes",
  description: "Write an outline, flip it into a mind map. AI suggestions on every node. Works offline, free.",
  robots: { index: false }, // the marketing site is the indexable surface
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#16181d" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={onest.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
