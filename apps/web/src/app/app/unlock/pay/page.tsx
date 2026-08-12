"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function PayFlow() {
  const params = useSearchParams();
  const chain = params.get("chain") ?? "xrp";
  const dest = params.get("dest") ?? "";
  const secret = params.get("secret") ?? "";

  const [txHash, setTxHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [onChainTx, setOnChainTx] = useState<string | null>(null);

  async function verify() {
    setErr(null);
    setPending(false);
    if (!txHash.trim()) {
      setErr("Paste the transaction id for your payment.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.attestPayment({
        topicUri: `topic://payment/${chain}/${dest}`,
        txHash: txHash.trim(),
        fireOnChain: true,
      });
      if (res.status === "pending_proof") {
        setPending(true);
      } else if (res.event) {
        setUnlocked(true);
        if (res.onChain?.mode === "live" && res.onChain.txHash) {
          setOnChainTx(res.onChain.txHash);
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!dest) {
    return <div className="alert error">This link is missing a destination address.</div>;
  }

  if (unlocked) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <span className="pill success">Verified by Flare</span>
        <h2 style={{ marginTop: "0.75rem" }}>Unlocked</h2>
        <p style={{ whiteSpace: "pre-wrap", color: "var(--ink)", lineHeight: 1.6 }}>{secret}</p>
        {onChainTx && (
          <a
            className="proof-link mono"
            style={{ display: "inline-block", marginTop: "0.75rem", fontSize: "0.78rem" }}
            href={`https://coston2-explorer.flare.network/tx/${onChainTx}`}
            target="_blank"
            rel="noreferrer"
          >
            View on-chain trigger →
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h2>Pay to unlock</h2>
      <p className="muted" style={{ fontSize: "0.9rem" }}>
        Send any {chain.toUpperCase()} payment to the address below, then paste the transaction id.
      </p>
      <div className="mono" style={{ margin: "0.75rem 0", wordBreak: "break-all" }}>{dest}</div>
      <div className="form">
        <label>
          Transaction id
          <input
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="Paste your transaction id"
            className="mono"
          />
        </label>
        <button className="btn btn-primary" onClick={verify} disabled={busy}>
          {busy ? "Verifying…" : "I've paid — verify"}
        </button>
        {pending && (
          <div className="alert">
            Submitted to Flare&apos;s FDC — the proof isn&apos;t finalized yet (voting round takes
            ~90s). Wait a moment, then hit verify again.
          </div>
        )}
        {err && <div className="alert error">{err}</div>}
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <>
      <section className="hero">
        <h1>Pay to unlock</h1>
        <p>
          <Link href="/app/unlock" className="site-link">Create your own gate →</Link>
        </p>
      </section>
      <Suspense fallback={<div className="muted">Loading…</div>}>
        <PayFlow />
      </Suspense>
    </>
  );
}
