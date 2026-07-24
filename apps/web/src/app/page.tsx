import Link from "next/link";

const capabilities = [
  ["FDC Payment", "Convert XRP, BTC, and DOGE payment attestations into typed events with durable proof commitments."],
  ["FTSO Thresholds", "Evaluate live Flare prices against topic thresholds and route verified crossings to subscribers."],
  ["Proof-Gated Delivery", "Send HMAC-signed webhooks and optional on-chain triggers only after event verification."],
  ["Topic Fabric", "Define payment, price, web data, asset lifecycle, and composition topics with one URI grammar."],
];

const steps = [
  ["1", "Define", "Register a topic URI for the economic fact your application depends on."],
  ["2", "Verify", "Submit a source transaction id or read a live FTSO feed through the coordinator."],
  ["3", "Deliver", "Fan out signed webhooks and optional contract triggers with proof commitments attached."],
];

export default function LandingPage() {
  return (
    <div className="landing-page">
      <section className="landing-hero">
        <div className="eyebrow">Flare-native proof infrastructure</div>
        <h1>Economic events your systems can trust.</h1>
        <p>
          Casid turns Flare Data Connector attestations and FTSO feeds into a verified event layer for
          protocols, fintech backends, and agent platforms that need more than raw indexer data.
        </p>
        <div className="landing-actions">
          <Link className="btn btn-primary" href="/app">Launch app</Link>
          <Link className="btn btn-ghost" href="/app/docs">Read docs</Link>
        </div>
      </section>

      <section className="landing-band">
        <div className="metric"><strong>FDC</strong><span>Payment proofs</span></div>
        <div className="metric"><strong>FTSO</strong><span>Live price thresholds</span></div>
        <div className="metric"><strong>HMAC</strong><span>Signed webhook delivery</span></div>
        <div className="metric"><strong>Solidity</strong><span>Proof-gated triggers</span></div>
      </section>

      <section className="landing-section">
        <div className="section-copy">
          <div className="eyebrow">What Casid does</div>
          <h2>One fabric for payment truth, market truth, and downstream execution.</h2>
          <p>
            Applications subscribe to typed topics instead of maintaining their own watchers, feed readers,
            proof fetchers, signing layer, and trigger coordination.
          </p>
        </div>
        <div className="capability-grid">
          {capabilities.map(([title, body]) => (
            <div className="capability" key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section split">
        <div className="section-copy">
          <div className="eyebrow">Operator flow</div>
          <h2>From external economic fact to production event in three steps.</h2>
        </div>
        <div className="step-list">
          {steps.map(([n, title, body]) => (
            <div className="step-card" key={title}>
              <span>{n}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <h2>Launch the console and wire your first verified topic.</h2>
        <Link className="btn btn-primary" href="/app">Launch app</Link>
      </section>
    </div>
  );
}
