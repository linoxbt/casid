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
        <p>The topic model, proof flow, and contracts, briefly.</p>
      </section>

      <div className="card">
        <h2>On-chain verification status</h2>
        <p className="muted" style={{ lineHeight: 1.6, margin: "0.4rem 0 0" }}>
          {onChainVerification === "live" && (
            <>
              <span className="pill success">live</span> Real FDC Merkle proofs, verified on-chain.
            </>
          )}
          {onChainVerification === "mock" && (
            <>
              <span className="pill">mock</span> Accepts any non-empty proof — not yet cryptographic.
            </>
          )}
          {(onChainVerification === "unknown" || onChainVerification === "checking") && (
            <>
              <span className="pill">unknown</span> Coordinator offline or not configured.
            </>
          )}
        </p>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Why Casid exists</h2>
          <p className="muted" style={{ margin: 0 }}>Proof-gated topics, not raw indexer claims.</p>
        </div>
        <div className="card">
          <h2>The primitive</h2>
          <p className="muted" style={{ margin: 0 }}>
            <code className="mono">Attested Topics</code> — durable, typed, composable.
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

      <h2 className="section-title">Flare integration</h2>
      <div className="list">
        <div className="list-item">
          <strong>FDC Payment</strong>
          <p className="muted" style={{ margin: "0.4rem 0 0" }}>XRP/BTC/DOGE, Merkle-proven via the DA Layer.</p>
        </div>
        <div className="list-item">
          <strong>FTSOv2</strong>
          <p className="muted" style={{ margin: "0.4rem 0 0" }}>Live price thresholds, composable with payments.</p>
        </div>
        <div className="list-item">
          <strong>FAssets</strong>
          <p className="muted" style={{ margin: "0.4rem 0 0" }}>Lifecycle topics for mint/redeem.</p>
        </div>
        <div className="list-item">
          <strong>FCC (roadmap)</strong>
          <p className="muted" style={{ margin: "0.4rem 0 0" }}>Confidential topic filters — not yet built.</p>
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
