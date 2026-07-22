import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Casid — Verified Economic Event Fabric",
  description:
    "Kafka + Stripe Webhooks for multi-chain economic truth on Flare. Attested topics, FDC proofs, FTSO thresholds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <a href="/" className="brand">
              <span className="brand-mark" />
              <span>
                Casid
                <small>Verified Economic Event Fabric</small>
              </span>
            </a>
            <nav className="nav">
              <a href="/">Console</a>
              <a href="/topics">Topics</a>
              <a href="/events">Events</a>
              <a href="/contracts">Contracts</a>
              <a href="/docs">Architecture</a>
            </nav>
          </header>
          <main className="main">{children}</main>
          <footer className="footer">
            <span>Built on Flare · FDC · FTSO · FAssets</span>
            <span>Casid © 2026</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
