import type { ReactNode } from "react";

/** Minimal inline icon set (lucide-style strokes), server-rendered SVG. */
function Icon({ size = 16, children, className }: { size?: number; children: ReactNode; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

type P = { size?: number; className?: string };

export const OutlineIcon = (p: P) => (
  <Icon {...p}>
    <path d="M21 12h-8M21 6H8M21 18h-8M3 6v4a2 2 0 0 0 2 2h3M3 10v6a2 2 0 0 0 2 2h3" />
  </Icon>
);
export const MapIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="5" cy="12" r="2.5" />
    <path d="M7.5 12c4 0 4-6 8-6M7.5 12c4 0 4 6 8 6M7.5 12h8" />
    <circle cx="18.5" cy="6" r="1.6" />
    <circle cx="18.5" cy="12" r="1.6" />
    <circle cx="18.5" cy="18" r="1.6" />
  </Icon>
);
export const SparkleIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" />
    <path d="M19 3v4M21 5h-4" />
  </Icon>
);
export const WifiOffIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 4.2-2.7M5 12.9a10 10 0 0 1 5.2-2.7M22 8.8a15 15 0 0 0-11.3-3.8M19 12.9a10 10 0 0 0-2.1-1.6M2 2l20 20" />
  </Icon>
);
export const FileIcon = (p: P) => (
  <Icon {...p}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z" />
    <path d="M14 2v6h6M8 13h8M8 17h5" />
  </Icon>
);
export const DriveIcon = (p: P) => (
  <Icon {...p}>
    <path d="M22 12H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11zM6 16h.01M10 16h.01" />
  </Icon>
);
export const CloudIcon = (p: P) => (
  <Icon {...p}>
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    <path d="m9 14 2 2 4-4" />
  </Icon>
);
export const DownloadIcon = (p: P) => (
  <Icon {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </Icon>
);
export const MenuIcon = (p: P) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);
export const ArrowRightIcon = (p: P) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);
export const CheckIcon = (p: P) => (
  <Icon {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);
export const ShieldIcon = (p: P) => (
  <Icon {...p}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </Icon>
);
export const LayersIcon = (p: P) => (
  <Icon {...p}>
    <path d="m12 2 10 5-10 5L2 7z" />
    <path d="m2 17 10 5 10-5M2 12l10 5 10-5" />
  </Icon>
);
