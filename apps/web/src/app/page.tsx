import Link from "next/link";

const ticker = [
  "FDC payment proofs",
  "FTSO threshold checks",
  "HMAC delivery",
  "On-chain trigger fire",
  "Coston2 verification",
];

const stages = [
  ["Verify", "Submit a real transaction id or live feed check against the Flare-backed coordinator."],
  ["Attest", "Package the proof commitment and delivery metadata into a signed economic event."],
  ["Anchor", "Fan it out through webhooks or on-chain triggers with the record already traceable."],
];

const surfaces = [
  ["App console", "Topic creation, proof submission, webhook subscriptions, and the event ledger in one place."],
  ["Docs", "The topic model, proof flow, and Flare integration explained without the product fluff."],
];

export default function LandingPage() {
  return (
    <div>
      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[...ticker, ...ticker].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </div>

      <div className="page-frame">
        <header className="site-header">
          <Link href="/" className="brand brand-inline">
            <span className="brand-mark">C</span>
            <span>
              Casid
              <small>Verified Economic Event Fabric</small>
            </span>
          </Link>
          <div className="site-actions">
            <Link href="/app" className="site-link">Dashboard</Link>
            <Link href="/app/docs" className="site-link">Docs</Link>
            <Link href="/app" className="btn btn-primary">Launch app</Link>
          </div>
        </header>

        <main>
          <section className="hero-grid">
            <div>
              <p className="eyebrow">Flare-native verification infrastructure</p>
              <h1>Economic events your systems can trust.</h1>
              <p className="hero-copy">
                Casid turns Flare Data Connector attestations and FTSO feeds into a verified event layer
                for protocols, fintech backends, and agent platforms that need more than raw indexer data.
              </p>
              <div className="hero-actions">
                <Link className="btn btn-primary" href="/app">Launch app</Link>
                <Link className="btn btn-ghost" href="/app/docs">Read docs</Link>
              </div>
            </div>

            <div className="hero-panel">
              <div className="hero-panel-header">
                <span>System status</span>
                <span className="pill success">live</span>
              </div>
              <div className="status-grid">
                <div>
                  <strong>FDC</strong>
                  <span>Payment proofs</span>
                </div>
                <div>
                  <strong>FTSO</strong>
                  <span>Live threshold feeds</span>
                </div>
                <div>
                  <strong>HMAC</strong>
                  <span>Signed delivery</span>
                </div>
                <div>
                  <strong>Solidity</strong>
                  <span>On-chain triggers</span>
                </div>
              </div>
            </div>
          </section>

          <section className="section-block">
            <div className="section-copy">
              <p className="eyebrow">How it works</p>
              <h2>Three checks, one verified record.</h2>
            </div>
            <div className="step-grid">
              {stages.map(([title, body], index) => (
                <article className="step-card" key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="section-block split">
            <div className="section-copy">
              <p className="eyebrow">Two surfaces</p>
              <h2>One engine, two ways to operate it.</h2>
            </div>
            <div className="surface-grid">
              {surfaces.map(([title, body]) => (
                <article className="surface-card" key={title}>
                  <p className="surface-label">surface</p>
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
        </main>

        <footer className="site-footer">
          <span>Built on Flare · FDC · FTSO · FAssets</span>
          <span>Casid © 2026</span>
        </footer>
      </div>
    </div>
  );
}
