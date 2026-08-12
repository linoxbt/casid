import { useId } from "react";

/**
 * Casid mark: a padlock (shackle + body) with a checkmark cut out of the
 * body as negative space — "unlock, verified" as one glyph. Built from
 * plain geometry (arc + rounded rect + one stroked checkmark path in an SVG
 * mask), the same reliable technique as before, different shape family.
 */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  const id = `casid-lock-${useId()}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M15 21 V16 A9 9 0 0 1 33 16 V21"
        stroke="var(--accent)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <mask id={id} maskUnits="userSpaceOnUse">
        <rect width="48" height="48" fill="#fff" />
        <path
          d="M16 30.5 L22 36.5 L34 21.5"
          stroke="#000"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </mask>
      <rect x="8" y="19" width="32" height="23" rx="6" fill="var(--accent)" mask={`url(#${id})`} />
    </svg>
  );
}

export function Logo({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`brand ${className}`}>
      <LogoMark size={size} />
      Casid
    </span>
  );
}
