/**
 * "Sprig" logo mark (DESIGN.md §13). Seed circle with three shoots; the
 * highest bud is marigold (the idea being suggested).
 * `--mark-ink` can be overridden for a monochrome version.
 */
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  const ink = { fill: "var(--mark-ink, var(--primary))" };
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" strokeWidth="2.6" strokeLinecap="round" style={{ stroke: "var(--mark-ink, var(--primary))" }}>
        <path d="M11 16.5C16 16.5 16 7 24.5 7" />
        <path d="M11 16.5C16.5 16.5 18 15.6 26.5 15.6" />
        <path d="M11 16.5C16 16.5 16.5 24.6 22.5 24.6" />
      </g>
      <circle cx="8" cy="16.5" r="4.6" style={ink} />
      <circle cx="25.2" cy="7" r="2.9" style={{ fill: "var(--ai)" }} />
      <circle cx="27" cy="15.6" r="2.1" style={ink} />
      <circle cx="23" cy="24.6" r="2.1" style={ink} />
    </svg>
  );
}
