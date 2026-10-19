import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icon: the noodl mark (iOS adds its own rounded mask).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FFF4CC",
        }}
      >
<svg width="180" height="180" viewBox="0 0 128 128">
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
      </div>
    ),
    size,
  );
}
