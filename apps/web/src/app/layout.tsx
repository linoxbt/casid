import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
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
            <Link href="/" className="brand">
              <Image src="/brand/casid-mark.svg" alt="" width={42} height={42} className="brand-mark" />
              <span>
                Casid
                <small>Verified Economic Event Fabric</small>
              </span>
            </Link>
            <details className="hamburger-menu">
              <summary aria-label="Open navigation">
                <span />
                <span />
                <span />
              </summary>
              <nav className="drawer-nav" aria-label="Main navigation">
                <Link href="/">Home</Link>
                <Link href="/app">Launch app</Link>
                <Link href="/app/topics">Topics</Link>
                <Link href="/app/events">Events</Link>
                <Link href="/app/docs">Docs</Link>
              </nav>
            </details>
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
