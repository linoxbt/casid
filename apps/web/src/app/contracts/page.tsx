"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const EXPLORER = "https://coston2-explorer.flare.network";

const CASID_CONTRACTS = [
  {
    name: "TopicRegistry",
    address: "0xe132a226382E3A872d558c8c576f0aaeF864bE7C",
    role: "Canonical attested topic IDs, schema hashes, AND/OR compositions",
  },
  {
    name: "ProofVerifier",
    address: "0x787c170ad57D650D2BeE947A25c22F677B22bd87",
    role: "FDC / mock proof verification + anti-replay (usedProof)",
  },
  {
    name: "SubscriptionHub",
    address: "0xAd5dD33d2F753891A18A970361C81a87c401f31d",
    role: "On-chain subscriptions, webhook commits, credits",
  },
  {
    name: "TriggerExecutor",
    address: "0x29e1f57044ce6C22Db362222e4a66da78F5acd3e",
    role: "Proof-gated fireWithProof / fireFtsoThreshold",
  },
] as const;

export default function ContractsPage() {
  const [meta, setMeta] = useState<Awaited<ReturnType<typeof api.meta>> | null>(
    null,
  );
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .meta()
      .then(setMeta)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <>
      <section className="hero">
        <div className="badge-row">
          <span className="badge accent">Coston2</span>
          <span className="badge">chainId 114</span>
          <span className="badge">solc 0.8.25 verified</span>
        </div>
        <h1>Deployed contracts</h1>
        <p>
          Casid core contracts are live and source-verified on Flare Testnet
          Coston2. Protocol addresses (FTSO, FDC) are resolved dynamically from
          the Flare Contract Registry.
        </p>
      </section>

      {err && <div className="alert error">{err}</div>}

      <h2 className="section-title">Casid (verified)</h2>
      <div className="list">
        {CASID_CONTRACTS.map((c) => (
          <div key={c.address} className="list-item">
            <header>
              <strong>{c.name}</strong>
              <span className="pill success">verified</span>
            </header>
            <p className="muted" style={{ margin: "0.35rem 0 0.5rem" }}>
              {c.role}
            </p>
            <a
              className="mono"
              href={`${EXPLORER}/address/${c.address}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent)" }}
            >
              {c.address}
            </a>
          </div>
        ))}
      </div>

      <h2 className="section-title">Flare protocol (registry)</h2>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Address</th>
            </tr>
          </thead>
          <tbody>
            {meta?.protocol &&
              Object.entries(meta.protocol).map(([k, v]) =>
                v ? (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>
                      <a
                        className="mono"
                        href={`${EXPLORER}/address/${v}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "var(--accent)" }}
                      >
                        {v}
                      </a>
                    </td>
                  </tr>
                ) : null,
              )}
            {!meta?.protocol && (
              <tr>
                <td colSpan={2} className="muted">
                  Load meta from coordinator…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">Demo transactions</h2>
      <div className="card">
        <ul className="pipeline">
          <li>
            <a
              href={`${EXPLORER}/tx/0xa975da7f94beb030dae88c847768bceb78d73e5bd1075ac80b3c97e74614de2f`}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent)" }}
            >
              fireWithProof (manual)
            </a>
          </li>
          <li>
            <a
              href={`${EXPLORER}/tx/0xf288b45a5029981d9cb41917acc97f4aa23b8e983c987838905cd1ff365b24d2`}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent)" }}
            >
              fireWithProof (API)
            </a>
          </li>
          <li>
            Full deployment map:{" "}
            <code className="mono">deployments/coston2.json</code>
          </li>
        </ul>
      </div>
    </>
  );
}
