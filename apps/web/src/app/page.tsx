import { Fragment } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Reveal } from "@/components/reveal";

const capabilities = [
  "FDC Payment Proofs",
  "FTSO Price Thresholds",
  "HMAC Signed Webhooks",
  "On-chain Triggers",
  "Coston2 Testnet",
];

const flowSteps = ["Payment sent", "Flare verifies", "Unlocked"];

const features = [
  ["Proof-gated", "Verified by FDC before anything fires."],
  ["Signed delivery", "HMAC-signed webhooks, retried until delivered."],
  ["On-chain triggers", "One proof, one gated Solidity trigger."],
];

const steps = [
  ["Create a topic", "Register a typed topic URI."],
  ["Verify or subscribe", "Submit a proof, or watch continuously."],
  ["Get the verified event", "A signed record lands in your ledger."],
];

const contracts = [
  { name: "TopicRegistry", addr: "0xe132a226382E3A872d558c8c576f0aaeF864bE7C" },
  { name: "ProofVerifier", addr: "0x3f800eeE8f1b4e0c6FCD90ce70BC3aB581151Ffc" },
  { name: "SubscriptionHub", addr: "0xAd5dD33d2F753891A18A970361C81a87c401f31d" },
  { name: "TriggerExecutor", addr: "0x50622392654467D6ebb544A74215B655e812C9Fd" },
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
        <section className="hero-band">
          <div className="orb-field" aria-hidden="true">
            <div className="orb orb-1" />
            <div className="orb orb-2" />
          </div>
          <div className="page-frame">
            <div className="hero-grid">
              <p className="eyebrow">Flare-native · FDC verified</p>
              <h1>Get paid, unlock instantly.</h1>
              <p className="hero-copy">
                Share a link. A real payment arrives, Flare verifies it, your content unlocks.
              </p>
              <div className="hero-actions">
                <Link className="btn btn-primary" href="/app/unlock">Try Unlock</Link>
                <Link className="btn btn-ghost" href="/app">Casid infrastructure →</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="capability-band">
          <div className="page-frame capability-strip">
            {capabilities.map((c) => (
              <span className="pill" key={c}>{c}</span>
            ))}
          </div>
        </section>

        <Reveal>
          <section className="section-block">
            <div className="page-frame">
              <div className="section-copy">
                <p className="eyebrow">How it works</p>
                <h2>No trust required.</h2>
              </div>
              <div className="flow-diagram">
                {flowSteps.map((label, i) => (
                  <Fragment key={label}>
                    <div className="flow-step">
                      <div className="flow-node">{i + 1}</div>
                      <p>{label}</p>
                    </div>
                    {i < flowSteps.length - 1 && (
                      <div className="flow-connector">
                        <span className="flow-pulse" style={{ animationDelay: `${i * 0.7}s` }} />
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="section-block band">
            <div className="page-frame">
              <div className="section-copy">
                <p className="eyebrow">One model</p>
                <h2>Every economic fact, one typed topic.</h2>
                <p>
                  <code className="mono">topic://payment/xrp/{"{destination}"}</code> and{" "}
                  <code className="mono">topic://ftso/price/{"{feed}"}/threshold/{"{op}"}/{"{value}"}</code>
                </p>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="section-block">
            <div className="page-frame">
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
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="section-block band">
            <div className="page-frame">
              <div className="section-copy">
                <p className="eyebrow">Verify it yourself</p>
                <h2>Every claim, on-chain.</h2>
              </div>
              <div className="proof-strip">
                {contracts.map((c) => (
                  <a
                    key={c.name}
                    className="proof-card"
                    href={`https://coston2-explorer.flare.network/address/${c.addr}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="proof-card-name">{c.name}</span>
                    <span className="proof-card-addr mono">{c.addr}</span>
                  </a>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="section-block">
            <div className="page-frame">
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
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="section-block">
            <div className="page-frame">
              <div className="cta-strip">
                <div>
                  <p className="eyebrow">Operator flow</p>
                  <h2>Open the console and wire your first verified topic.</h2>
                </div>
                <Link className="btn btn-primary" href="/app">Open dashboard</Link>
              </div>
            </div>
          </section>
        </Reveal>
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
            <Link href="/app/unlock">Unlock</Link>
            <Link href="/app">Dashboard</Link>
            <Link href="/app/topics">Topics</Link>
            <Link href="/app/verify">Verify</Link>
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
