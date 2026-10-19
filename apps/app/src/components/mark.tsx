/** "Sprig" — the product mark (seed + three shoots; the top bud is the AI marigold). */
export function Mark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <g fill="none" stroke="var(--primary)" strokeWidth="2.6" strokeLinecap="round">
        <path d="M11 16.5C16 16.5 16 7 24.5 7" />
        <path d="M11 16.5C16.5 16.5 18 15.6 26.5 15.6" />
        <path d="M11 16.5C16 16.5 16.5 24.6 22.5 24.6" />
      </g>
      <circle cx="8" cy="16.5" r="4.6" fill="var(--primary)" />
      <circle cx="25.2" cy="7" r="2.9" fill="var(--ai)" />
      <circle cx="27" cy="15.6" r="2.1" fill="var(--primary)" />
      <circle cx="23" cy="24.6" r="2.1" fill="var(--primary)" />
    </svg>
  );
}
