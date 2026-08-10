"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, useSidebar } from "@/components/sidebar-context";

function PanelLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h12" />
      <path d="M6 10h12" />
      <path d="M6 16h12" />
    </svg>
  );
}

function PanelLeftCloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16" />
      <path d="M4 12h16" />
      <path d="M4 20h16" />
      <path d="M14 4l6 8-6 8" />
    </svg>
  );
}

const nav = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/topics", label: "Topics" },
  { href: "/app/verify", label: "Verify" },
  { href: "/app/events", label: "Events" },
  { href: "/app/docs", label: "Docs" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardShell>{children}</DashboardShell>
    </SidebarProvider>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { isCollapsed, toggleCollapsed } = useSidebar();

  return (
    <div className="dashboard-shell">
      <aside className={`dashboard-rail ${isCollapsed ? "collapsed" : "expanded"}`}>
        <div className={`rail-head ${isCollapsed ? "centered" : "spread"}`}>
          <Link href="/" className="brand brand-inline rail-brand">
            <span className="brand-mark">C</span>
            {!isCollapsed && (
              <span>
                Casid
                <small>Console</small>
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="rail-toggle"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <PanelLeftIcon /> : <PanelLeftCloseIcon />}
          </button>
        </div>

        {!isCollapsed && <p className="rail-copy">Register topics, submit proofs, verify feed thresholds, and monitor signed delivery.</p>}
        <nav className="rail-nav" aria-label="Dashboard navigation">
          {nav.map((item) => (
            <Link href={item.href} key={item.href} className="rail-link">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="rail-footer">
          {!isCollapsed && <span>Flare-backed</span>}
          <ThemeToggle className="rail-theme" />
        </div>
      </aside>

      <div className="dashboard-content">
        <header className="mobile-dashboard-bar">
          <Link href="/" className="brand brand-inline">
            <span className="brand-mark">C</span>
            <span>
              Casid
              <small>Console</small>
            </span>
          </Link>
          <div className="mobile-dashboard-actions">
            <ThemeToggle />
            <button
              type="button"
              onClick={toggleCollapsed}
              className="rail-toggle mobile-toggle"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <PanelLeftIcon /> : <PanelLeftCloseIcon />}
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
