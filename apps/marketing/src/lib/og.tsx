import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Shared Open Graph card (1200x630), rendered to PNG at build time.
 * Satori needs TTF/OTF/WOFF, so we read static WOFF files from @fontsource.
 * Colours are literal values of the light tokens (Satori has no CSS vars).
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const C = {
  paper: "#fbfcfe",
  dot: "#d3d8df",
  ink: "#1c2433",
  muted: "#626a7a",
  primary: "#2f4fd0",
  ai: "#e5a21c",
  b1: "#3c5ccf",
  b2: "#d4573d",
  b3: "#2f8a5a",
  rootBg: "#232c40",
  border: "#dfe3ea",
};

const fontDir = (pkg: string) => join(process.cwd(), "node_modules", "@fontsource", pkg, "files");

async function fonts() {
  const [display, sans600, sans400] = await Promise.all([
    readFile(join(fontDir("bricolage-grotesque"), "bricolage-grotesque-latin-700-normal.woff")),
    readFile(join(fontDir("onest"), "onest-latin-600-normal.woff")),
    readFile(join(fontDir("onest"), "onest-latin-400-normal.woff")),
  ]);
  return [
    { name: "Bricolage", data: display, weight: 700 as const, style: "normal" as const },
    { name: "Onest", data: sans600, weight: 600 as const, style: "normal" as const },
    { name: "Onest", data: sans400, weight: 400 as const, style: "normal" as const },
  ];
}

function MarkSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <g fill="none" stroke={C.primary} strokeWidth="2.6" strokeLinecap="round">
        <path d="M11 16.5C16 16.5 16 7 24.5 7" />
        <path d="M11 16.5C16.5 16.5 18 15.6 26.5 15.6" />
        <path d="M11 16.5C16 16.5 16.5 24.6 22.5 24.6" />
      </g>
      <circle cx="8" cy="16.5" r="4.6" fill={C.primary} />
      <circle cx="25.2" cy="7" r="2.9" fill={C.ai} />
      <circle cx="27" cy="15.6" r="2.1" fill={C.primary} />
      <circle cx="23" cy="24.6" r="2.1" fill={C.primary} />
    </svg>
  );
}

export async function renderOg({ title, eyebrow }: { title: string; eyebrow?: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundColor: C.paper,
          backgroundImage: `radial-gradient(${C.dot} 1.6px, transparent 1.8px)`,
          backgroundSize: "28px 28px",
          color: C.ink,
          fontFamily: "Onest",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <MarkSvg size={52} />
          <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.01em" }}>MindNote Web</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 860 }}>
          {eyebrow ? (
            <div style={{ fontSize: 28, color: C.muted, marginBottom: 18 }}>{eyebrow}</div>
          ) : null}
          <div
            style={{
              fontFamily: "Bricolage",
              fontSize: title.length > 42 ? 70 : 84,
              lineHeight: 1,
              letterSpacing: "-0.035em",
              fontWeight: 700,
            }}
          >
            {title}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 26, color: C.muted }}>Free in your browser · Works offline · No account needed</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: C.b1 }} />
            <div style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: C.b2 }} />
            <div style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: C.b3 }} />
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
}
