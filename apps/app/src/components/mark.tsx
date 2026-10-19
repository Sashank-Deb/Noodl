/** The noodl mark (packages/brand/app-icon.svg): a looping noodle on a butter tile. Colours follow the theme via --brand-* tokens. */
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 128 128" aria-hidden="true" focusable="false">
      <rect width="128" height="128" rx="28" style={{ fill: "var(--brand-tile)" }} />
      <path
        d="M24 69C28 53 40 29 55 30C69 31 70 49 76 58C81 66 91 65 96 57C103 45 91 39 79 43C62 48 48 62 39 77"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        style={{ stroke: "var(--brand-ink)" }}
      />
      <path d="M78 22C78 18 79 14 80 11" strokeWidth="5.5" strokeLinecap="round" style={{ stroke: "var(--brand-gold)" }} />
      <path d="M87 28C91 24 94 22 98 20" strokeWidth="5.5" strokeLinecap="round" style={{ stroke: "var(--brand-gold)" }} />
    </svg>
  );
}
