"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "./theme-toggle";

const nav = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/topics", label: "Topics" },
  { href: "/app/verify", label: "Verify" },
  { href: "/app/events", label: "Events" },
  { href: "/app/docs", label: "Docs" },
];

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="brand">
            <span className="brand-mark">C</span>
            Casid
          </Link>

          <nav className="site-nav" aria-label="Primary">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`site-nav-link ${pathname === item.href ? "active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="site-actions">
            <ThemeToggle />
            <Link href="/app" className="btn btn-primary">Launch app</Link>
            <button
              type="button"
              className="btn btn-ghost mobile-menu-toggle"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
              style={{ padding: 0, width: "2.5rem" }}
            >
              {open ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="mobile-nav-panel">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`site-nav-link ${pathname === item.href ? "active" : ""}`}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
