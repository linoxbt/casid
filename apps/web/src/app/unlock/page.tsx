"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Logo } from "@/components/logo";

const CHAINS = [
  { value: "xrp", label: "XRP (XRPL)" },
  { value: "btc", label: "BTC" },
  { value: "doge", label: "DOGE" },
];

export default function CreateGatePage() {
  const [chain, setChain] = useState("xrp");
  const [dest, setDest] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit() {
    setErr(null);
    setLink(null);
    if (!dest.trim()) {
      setErr("Enter the address you want payments sent to.");
      return;
    }
    if (!secret.trim()) {
      setErr("Enter what you want to unlock — a message, a link, a code.");
      return;
    }
    setBusy(true);
    try {
      const uri = `topic://payment/${chain}/${dest.trim()}`;
      await api.createTopic(uri);
      const params = new URLSearchParams({
        chain,
        dest: dest.trim(),
        secret: secret.trim(),
      });
      const url = `${window.location.origin}/unlock/pay?${params.toString()}`;
      setLink(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="theme-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <Logo />
          <div className="site-actions site-actions-end">
            <Link href="/" className="site-link">Casid</Link>
          </div>
        </div>
      </header>

      <main className="page-frame" style={{ paddingBlock: "3rem" }}>
        <section className="hero" style={{ textAlign: "center", border: "none", paddingBottom: 0 }}>
          <h1>Get paid, unlock instantly.</h1>
          <p style={{ margin: "0.6rem auto 0" }}>
            Share a link. The moment a real payment arrives, verified by Flare — not a claim — it
            unlocks whatever you attached.
          </p>
        </section>

        <div className="grid cols-2" style={{ marginTop: "2rem", maxWidth: 640, marginInline: "auto" }}>
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <h2>Create a gate</h2>
            <div className="form">
              <label>
                Chain
                <select value={chain} onChange={(e) => setChain(e.target.value)}>
                  {CHAINS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Your receiving address
                <input
                  value={dest}
                  onChange={(e) => setDest(e.target.value)}
                  placeholder="rYourXRPLAddress..."
                  className="mono"
                />
              </label>
              <label>
                What unlocks when payment arrives
                <textarea
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="A message, a private link, a discount code..."
                  rows={3}
                />
              </label>
              <button className="btn btn-primary" onClick={submit} disabled={busy}>
                {busy ? "Creating…" : "Create gate"}
              </button>
              {err && <div className="alert error">{err}</div>}
              {link && (
                <div className="alert success">
                  Share this link with the payer:
                  <div className="mono" style={{ marginTop: "0.5rem", wordBreak: "break-all" }}>{link}</div>
                  <button className="btn btn-ghost" style={{ marginTop: "0.6rem" }} onClick={copyLink}>
                    {copied ? "Copied" : "Copy link"}
                  </button>
                </div>
              )}
              <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>
                Nothing is stored until someone pays.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
