"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { WalletButton } from "./wallet-button";
import { SidebarProvider, useSidebar } from "./sidebar-context";

function DashboardIcon() {
  return (
    <svg viewBox="0 0 18 18" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="2.5" width="6" height="6" rx="1.2" />
      <rect x="9.5" y="2.5" width="6" height="4" rx="1.2" />
      <rect x="9.5" y="8.5" width="6" height="7" rx="1.2" />
      <rect x="2.5" y="10.5" width="6" height="5" rx="1.2" />
    </svg>
  );
}
export function TopicsIcon() {
  return (
    <svg viewBox="0 0 18 18" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 2.5 5 15.5M13 2.5l-2 13M2.5 6.5h13M2 11.5h13" />
    </svg>
  );
}
export function VerifyIcon() {
  return (
    <svg viewBox="0 0 18 18" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2 15 4.3v4.4C15 12.5 12.4 15 9 16c-3.4-1-6-3.5-6-7.3V4.3Z" />
      <path d="M6.3 9 8.3 11 12 6.8" />
    </svg>
  );
}
function UnlockIcon() {
  return (
    <svg viewBox="0 0 18 18" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8V6a4 4 0 0 1 7.5-1.9" />
      <rect x="3" y="8" width="12" height="8" rx="2" />
      <path d="M9 11.5v1.6" />
    </svg>
  );
}
function EventsIcon() {
  return (
    <svg viewBox="0 0 18 18" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="6.5" />
      <path d="M9 5.5V9l2.6 1.6" />
    </svg>
  );
}
export function DocsIcon() {
  return (
    <svg viewBox="0 0 18 18" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2.5h5.5L14 6v9.5H5z" />
      <path d="M10.3 2.5V6H14M7 9.5h4M7 12.2h4" />
    </svg>
  );
}
function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? "rotate(180deg)" : undefined }}>
      <rect x="2.5" y="3" width="13" height="12" rx="2" />
      <path d="M7 3v12" />
      <path d="M11.5 7.2 9.3 9l2.2 1.8" />
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

const nav = [
  { href: "/app", label: "Dashboard", icon: DashboardIcon },
  { href: "/app/unlock", label: "Unlock", icon: UnlockIcon },
  { href: "/app/topics", label: "Topics", icon: TopicsIcon },
  { href: "/app/verify", label: "Verify", icon: VerifyIcon },
  { href: "/app/events", label: "Events", icon: EventsIcon },
  { href: "/app/docs", label: "Docs", icon: DocsIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Shell>{children}</Shell>
    </SidebarProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { isCollapsed, toggleCollapsed, isMobileOpen, toggleMobileOpen, closeMobile } = useSidebar();
  const pathname = usePathname();

  const current = nav.find((item) =>
    item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href),
  );

  return (
    <div className={`app-shell ${isCollapsed ? "collapsed" : ""}`}>
      <aside className={`app-sidebar ${isMobileOpen ? "mobile-open" : ""}`}>
        <div className="app-sidebar-head">
          <Link href="/" className="brand">
            <LogoMark size={24} />
            <span className="app-sidebar-brand-text">Casid</span>
          </Link>
        </div>

        <nav className="app-sidebar-nav" aria-label="Primary">
          {nav.map((item) => {
            const active =
              item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`app-sidebar-link ${active ? "active" : ""}`}
                onClick={closeMobile}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="app-sidebar-foot">
          <button
            type="button"
            className="app-sidebar-collapse"
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <CollapseIcon collapsed={isCollapsed} />
          </button>
        </div>
      </aside>

      {isMobileOpen && <div className="app-sidebar-backdrop" onClick={closeMobile} />}

      <div className="app-content">
        <header className="app-topbar">
          <div className="app-topbar-start">
            <button
              type="button"
              className="app-topbar-menu"
              aria-label="Open menu"
              onClick={toggleMobileOpen}
            >
              <MenuIcon />
            </button>
            <Link href="/" className="brand app-topbar-brand">
              <LogoMark size={20} />
              Casid
            </Link>
            <span className="mono app-topbar-path">/ {current?.label.toLowerCase() ?? "app"}</span>
          </div>
          <div className="app-topbar-end">
            <span className="pill app-topbar-network">Coston2 · 114</span>
            <ThemeToggle />
            <WalletButton />
          </div>
        </header>
        <div className="app-page-frame">{children}</div>
      </div>
    </div>
  );
}
