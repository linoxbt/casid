"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function DocsPage() {
  const [onChainVerification, setOnChainVerification] = useState<
    "live" | "mock" | "unknown" | "checking"
  >("checking");

  useEffect(() => {
    let cancelled = false;
    api
      .meta()
      .then((m) => {
        if (!cancelled) setOnChainVerification(m.fdc?.onChainVerification ?? "unknown");
      })
      .catch(() => {
        if (!cancelled) setOnChainVerification("unknown");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <section className="hero">
        <h1>Docs</h1>
        <p>
          Casid is the verified economic event fabric for Flare. These docs explain
          the topic model, proof flow, delivery contract, and operating assumptions.
        </p>
      </section>

      <div className="card">
        <h2>On-chain proof verification status</h2>
        <p className="muted" style={{ lineHeight: 1.6, margin: "0.4rem 0 0" }}>
          {onChainVerification === "live" && (
            <>
              <span className="pill success">live</span> The deployed{" "}
              <code className="mono">ProofVerifier</code> is verifying real FDC
              Merkle proofs on-chain.
            </>
          )}
          {onChainVerification === "mock" && (
            <>
              <span className="pill">mock</span> The deployed{" "}
              <code className="mono">ProofVerifier</code> currently runs in{" "}
              <code className="mono">mockMode</code>: it accepts any non-empty
              proof rather than cryptographically verifying it. The off-chain
              FDC prepare/DA-proof pipeline above is genuinely live against
              Flare testnet infrastructure; only the final on-chain consumption
              step is not yet enforced.
            </>
          )}
          {(onChainVerification === "unknown" || onChainVerification === "checking") && (
            <>
              <span className="pill">unknown</span> Could not determine the
              on-chain verifier mode (coordinator offline or{" "}
              <code className="mono">PROOF_VERIFIER_ADDRESS</code> not configured).
            </>
          )}
        </p>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Why Casid exists</h2>
          <p className="muted" style={{ lineHeight: 1.6, margin: 0 }}>
            Blockchains only know their own state. Real economic activity happens
            as XRP/BTC/DOGE payments, FTSO prices, Web2 API facts, and FAsset
            lifecycle events. Casid makes those facts{" "}
            <strong style={{ color: "var(--text)" }}>
              typed topics with proof-gated subscriptions
            </strong>
            .
          </p>
        </div>
        <div className="card">
          <h2>New primitive</h2>
          <p className="muted" style={{ lineHeight: 1.6, margin: 0 }}>
            <code className="mono">Attested Topics</code> — durable schemas such
            as{" "}
            <code className="mono">
              topic://payment/xrp/{"{dest}"}
            </code>{" "}
            and compositions{" "}
            <code className="mono">AND(payment, ftso≥x)</code>. Consumers never
            fire without FDC/FTSO verification.
          </p>
        </div>
      </div>

      <h2 className="section-title">System diagram</h2>
      <div className="card">
        <pre className="mono" style={{ margin: 0, lineHeight: 1.55, color: "var(--muted)" }}>
{`[ XRPL / BTC / DOGE / Web2 / FTSO ]
              │
              ▼
     Flare FDC + FTSO (enshrined)
              │
              ▼
     Casid Coordinator
      · topic registry (off-chain + on-chain)
      · attestation pipeline
      · proof packaging
      · HMAC webhook fan-out
              │
        ┌─────┴─────┐
        ▼           ▼
  Signed webhooks   TriggerExecutor.sol
  (Stripe-style)    (proof-gated calls)
        │
        ▼
  Subscriber apps / agents / protocols`}
        </pre>
      </div>

      <h2 className="section-title">On-chain contracts</h2>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Contract</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">TopicRegistry</td>
              <td className="muted">Canonical topic IDs, schema hashes, compositions</td>
            </tr>
            <tr>
              <td className="mono">ProofVerifier</td>
              <td className="muted">FDC verification + anti-replay (usedProof)</td>
            </tr>
            <tr>
              <td className="mono">SubscriptionHub</td>
              <td className="muted">On-chain subs, webhook commits, credits</td>
            </tr>
            <tr>
              <td className="mono">TriggerExecutor</td>
              <td className="muted">fireWithProof / fireFtsoThreshold → events & calls</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="section-title">Flare integration (non-substitutable)</h2>
      <div className="list">
        <div className="list-item">
          <strong>FDC Payment</strong>
          <p className="muted" style={{ margin: "0.4rem 0 0" }}>
            Core leaf topic for XRP/BTC/DOGE. Merkle proofs via DA Layer; Casid
            never trusts raw indexer claims.
          </p>
        </div>
        <div className="list-item">
          <strong>FTSOv2</strong>
          <p className="muted" style={{ margin: "0.4rem 0 0" }}>
            Price-threshold topics with enshrined feeds — composition with
            payments for capital-market style conditions.
          </p>
        </div>
        <div className="list-item">
          <strong>FAssets</strong>
          <p className="muted" style={{ margin: "0.4rem 0 0" }}>
            Lifecycle topics (mint/redeem) and settlement asset for paid
            subscriptions.
          </p>
        </div>
        <div className="list-item">
          <strong>FCC (roadmap)</strong>
          <p className="muted" style={{ margin: "0.4rem 0 0" }}>
            Confidential topic filters and private destinations inside TEEs
            without leaking watch addresses on-chain.
          </p>
        </div>
      </div>

      <h2 className="section-title">Operational roadmap</h2>
      <div className="grid cols-2">
        <div className="card">
          <h3>Current system</h3>
          <ul className="pipeline">
            <li>Topic DSL + registry (TS + Solidity)</li>
            <li>Live FDC request, submit, and DA proof polling</li>
            <li>FTSO threshold path against live Flare feeds</li>
            <li>HMAC webhooks + dashboard</li>
            <li>Foundry suite for anti-replay & compositions</li>
          </ul>
        </div>
        <div className="card">
          <h3>Production path</h3>
          <ul className="pipeline">
            <li>Live FdcHub.requestAttestation + DA proofs</li>
            <li>Postgres + queue workers + retries</li>
            <li>On-chain trigger for paid SLAs</li>
            <li>Topic marketplace + enterprise private topics</li>
            <li>Decentralized coordinators</li>
          </ul>
        </div>
      </div>
    </>
  );
}
