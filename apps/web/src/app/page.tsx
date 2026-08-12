import Link from "next/link";
import { Logo } from "@/components/logo";

const capabilities = [
  "FDC Payment Proofs",
  "FTSO Price Thresholds",
  "HMAC Signed Webhooks",
  "On-chain Triggers",
  "Coston2 Testnet",
];

const features = [
  ["Proof-gated", "Verified by FDC or FTSO before anything fires."],
  ["Signed delivery", "HMAC-signed webhooks, retried until delivered."],
  ["On-chain triggers", "One proof, one gated Solidity trigger."],
];

const steps = [
  ["Create a topic", "Register a typed topic URI."],
  ["Verify or subscribe", "Submit a proof, or watch continuously."],
  ["Get the verified event", "A signed record lands in your ledger."],
];

export default function LandingPage() {
  return (
    <div className="theme-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <Logo />
          <div className="site-actions site-actions-end">
            <Link href="/app/docs" className="site-link">Docs</Link>
            <Link href="/app" className="btn btn-primary">Launch app</Link>
          </div>
        </div>
      </header>

      <main>
        <div className="page-frame">
          <section className="hero-grid">
            <p className="eyebrow">Flare-native · FDC + FTSO</p>
            <h1>The verified event layer for Flare.</h1>
            <p className="hero-copy">
              Proof-gated payments, price thresholds, and webhooks for protocols and backends that
              need more than raw indexer data.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/app">Launch app</Link>
              <Link className="btn btn-ghost" href="/app/docs">Read docs</Link>
            </div>
          </section>
        </div>

        <div className="capability-strip">
          {capabilities.map((c) => (
            <span className="pill" key={c}>{c}</span>
          ))}
        </div>

        <div className="page-frame">
          <section className="section-block centered">
            <div className="section-copy">
              <p className="eyebrow">One model</p>
              <h2>Every economic fact, one typed topic.</h2>
              <p>
                <code className="mono">topic://payment/xrp/{"{destination}"}</code> and{" "}
                <code className="mono">topic://ftso/price/{"{feed}"}/threshold/{"{op}"}/{"{value}"}</code>{" "}
                — the same shape, whatever you&apos;re watching.
              </p>
            </div>
          </section>

          <section className="section-block">
            <div className="section-copy">
              <p className="eyebrow">Why Casid</p>
              <h2>Verification, not indexing.</h2>
            </div>
            <div className="step-grid">
              {features.map(([title, body]) => (
                <article className="step-card" key={title}>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="section-block">
            <div className="section-copy">
              <p className="eyebrow">Getting started</p>
              <h2>Three steps to a verified event.</h2>
            </div>
            <div className="step-grid">
              {steps.map(([title, body], index) => (
                <article className="step-card" key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="cta-strip">
            <div>
              <p className="eyebrow">Operator flow</p>
              <h2>Open the console and wire your first verified topic.</h2>
            </div>
            <Link className="btn btn-primary" href="/app">Open dashboard</Link>
          </section>
        </div>
      </main>

      <footer className="site-footer">
        <div className="page-frame footer-cols">
          <div className="footer-col">
            <Logo />
            <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.86rem", lineHeight: 1.55 }}>
              Verified economic event fabric for Flare.
            </p>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <Link href="/app">Dashboard</Link>
            <Link href="/app/topics">Topics</Link>
            <Link href="/app/verify">Verify</Link>
            <Link href="/app/events">Events</Link>
          </div>
          <div className="footer-col">
            <h4>Resources</h4>
            <Link href="/app/docs">Docs</Link>
            <a href="https://github.com/linoxbt/casid" target="_blank" rel="noreferrer">GitHub</a>
            <a href="https://coston2-explorer.flare.network" target="_blank" rel="noreferrer">Coston2 Explorer</a>
          </div>
        </div>
        <div className="page-frame footer-bottom">
          <span>Built on Flare · FDC · FTSO</span>
          <span>Casid © 2026</span>
        </div>
      </footer>
    </div>
  );
}
