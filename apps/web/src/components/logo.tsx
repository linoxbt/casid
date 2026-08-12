import { useId } from "react";

/**
 * Casid mark: a flat-top hexagon (network / ledger node) with a checkmark
 * cut out of it as negative space (verified). Built from plain geometry
 * (hexagon path + one stroked checkmark path inside an SVG mask) rather
 * than a letterform, so it stays legible from favicon size up.
 */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  const id = `casid-mark-${useId()}`;
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
      <mask id={id} maskUnits="userSpaceOnUse">
        <rect width="48" height="48" fill="#fff" />
        <path
          d="M13 24 L20.5 31 L36 12"
          stroke="#000"
          strokeWidth="6.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </mask>
      <path
        d="M44 24 34 41.28 14 41.28 4 24 14 6.72 34 6.72Z"
        fill="var(--accent)"
        mask={`url(#${id})`}
      />
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
