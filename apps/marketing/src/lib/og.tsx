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
  paper: "#f8fafc",
  dot: "#ccd0d4",
  ink: "#161b24",
  muted: "#5e636d",
  primary: "#2858cd",
  ai: "#d48f00",
  b1: "#3065cc",
  b2: "#cc3f2f",
  b3: "#1e8347",
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
<svg width={size} height={size} viewBox="0 0 128 128">
      <rect width="128" height="128" rx="28" fill="#FFF4CC" />
      <path
        d="M24 69C28 53 40 29 55 30C69 31 70 49 76 58C81 66 91 65 96 57C103 45 91 39 79 43C62 48 48 62 39 77"
        stroke="#151515"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M78 22C78 18 79 14 80 11" stroke="#FFB83D" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M87 28C91 24 94 22 98 20" stroke="#FFB83D" strokeWidth="5.5" strokeLinecap="round" />
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
          <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.01em" }}>noodl</div>
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
