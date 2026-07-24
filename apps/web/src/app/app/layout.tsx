import Link from "next/link";

const nav = [
  { href: "/app", label: "Overview" },
  { href: "/app/topics", label: "Topics" },
  { href: "/app/events", label: "Events" },
  { href: "/app/docs", label: "Docs" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar desktop-sidebar">
        <div>
          <div className="sidebar-kicker">Console</div>
          <h2>Casid operations</h2>
          <p>Register topics, submit proofs, verify feed thresholds, and monitor signed delivery.</p>
        </div>
        <nav className="sidebar-nav" aria-label="Console navigation">
          {nav.map((item) => (
            <Link href={item.href} key={item.href}>{item.label}</Link>
          ))}
        </nav>
        <div className="sidebar-note">
          Events are recorded after Flare proof material or live feed data is available.
        </div>
      </aside>
      <div className="app-content">
        <details className="mobile-console-menu">
          <summary>Console menu</summary>
          <nav className="sidebar-nav" aria-label="Mobile console navigation">
            {nav.map((item) => (
              <Link href={item.href} key={item.href}>{item.label}</Link>
            ))}
          </nav>
        </details>
        {children}
      </div>
    </div>
  );
}
