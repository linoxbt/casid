"use client";

import { useTheme } from "./theme-provider";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2" />
      <path d="M12 19.5v2" />
      <path d="M4.7 4.7l1.4 1.4" />
      <path d="M17.9 17.9l1.4 1.4" />
      <path d="M2.5 12h2" />
      <path d="M19.5 12h2" />
      <path d="M4.7 19.3l1.4-1.4" />
      <path d="M17.9 6.1l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-sm border border-line text-ink/75 transition hover:border-accent/50 hover:text-accent ${className}`}
    >
      <span suppressHydrationWarning>{theme === "light" ? <MoonIcon /> : <SunIcon />}</span>
    </button>
  );
}
