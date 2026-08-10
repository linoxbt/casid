"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Topic } from "@/lib/api";

export default function VerifyPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.topics();
      setTopics(res.topics);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const paymentTopics = topics.filter((t) => t.kind === "PAYMENT");
  const ftsoTopics = topics.filter((t) => t.kind === "FTSO_THRESHOLD");
  const compositionTopics = topics.filter((t) => t.kind === "COMPOSITION");

  return (
    <>
      <section className="hero">
        <h1>Verify</h1>
        <p>
          Submit real proof material to turn a registered topic into a verified event: an FDC
          Payment transaction id, a live FTSO threshold check, a composition evaluation, or a
          standalone address-validity attestation.
        </p>
      </section>

      {err && <div className="alert error">{err}</div>}

      <div className="grid cols-2">
        <PaymentCard topics={paymentTopics} onSettled={load} />
        <FtsoCard topics={ftsoTopics} onSettled={load} />
      </div>
      <div className="grid cols-2">
        <CompositionCard topics={compositionTopics} />
        <AddressValidityCard />
      </div>
    </>
  );
}

function PaymentCard({ topics, onSettled }: { topics: Topic[]; onSettled: () => void }) {
  const [topicUri, setTopicUri] = useState("");
  const [txHash, setTxHash] = useState("");
  const [amount, setAmount] = useState("");
  const [fireOnChain, setFireOnChain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!topicUri && topics[0]) setTopicUri(topics[0].uri);
  }, [topics, topicUri]);

  async function submit() {
    setMsg(null);
    setErr(null);
    if (!topicUri) {
      setErr("Create a payment topic first.");
      return;
    }
    if (!txHash.trim()) {
      setErr("txHash is required for FDC Payment attestation.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.attestPayment({
        topicUri,
        txHash: txHash.trim(),
        amount: amount.trim() || undefined,
        fireOnChain,
      });
      if (res.status === "pending_proof") {
        setMsg(
          "Prepared and submitted to FdcHub, but the proof isn't finalized yet — the voting round hasn't closed. Try again in ~90s.",
        );
      } else if (res.event) {
        setMsg(
          `Verified event recorded: ${res.event.proofHash.slice(0, 16)}… (${res.deliveries?.length ?? 0} webhook deliveries${res.onChain?.mode === "live" ? `, on-chain tx ${res.onChain.txHash?.slice(0, 10)}…` : res.onChain?.mode === "dry_run" ? ", on-chain fire skipped (dry run)" : ""})`,
        );
      }
      onSettled();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Submit payment proof</h2>
      <div className="form">
        <label>
          Payment topic
          <select value={topicUri} onChange={(e) => setTopicUri(e.target.value)}>
            {topics.length === 0 && <option value="">No PAYMENT topics yet</option>}
            {topics.map((t) => (
              <option key={t.id} value={t.uri}>
                {t.uri}
              </option>
            ))}
          </select>
        </label>
        <label>
          Transaction id
          <input
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="Real XRP/BTC/DOGE transaction id"
            className="mono"
          />
        </label>
        <label>
          Amount (smallest units, optional)
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000000" />
        </label>
        <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={fireOnChain}
            onChange={(e) => setFireOnChain(e.target.checked)}
            style={{ width: "auto" }}
          />
          Fire on-chain trigger
        </label>
        <button className="btn btn-primary" onClick={submit} disabled={busy || !topics.length}>
          {busy ? "Submitting…" : "Submit proof"}
        </button>
        {msg && <div className="alert success">{msg}</div>}
        {err && <div className="alert error">{err}</div>}
      </div>
    </div>
  );
}

function FtsoCard({ topics, onSettled }: { topics: Topic[]; onSettled: () => void }) {
  const [topicUri, setTopicUri] = useState("");
  const [fireOnChain, setFireOnChain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!topicUri && topics[0]) setTopicUri(topics[0].uri);
  }, [topics, topicUri]);

  async function submit() {
    setMsg(null);
    setErr(null);
    if (!topicUri) {
      setErr("Create an FTSO threshold topic first.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.attestFtso({ topicUri, fireOnChain });
      setMsg(
        `Observed price ${res.observedPrice} crossed the threshold — event ${res.event.proofHash.slice(0, 16)}… recorded (${res.deliveries.length} deliveries).`,
      );
      onSettled();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Check FTSO threshold</h2>
      <div className="form">
        <label>
          Price topic
          <select value={topicUri} onChange={(e) => setTopicUri(e.target.value)}>
            {topics.length === 0 && <option value="">No FTSO_THRESHOLD topics yet</option>}
            {topics.map((t) => (
              <option key={t.id} value={t.uri}>
                {t.uri}
              </option>
            ))}
          </select>
        </label>
        <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={fireOnChain}
            onChange={(e) => setFireOnChain(e.target.checked)}
            style={{ width: "auto" }}
          />
          Fire on-chain trigger
        </label>
        <button className="btn btn-primary" onClick={submit} disabled={busy || !topics.length}>
          {busy ? "Checking…" : "Read live price & verify"}
        </button>
        <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
          Reads the live FTSOv2 feed. Fails with an error if the price hasn&apos;t crossed the
          topic&apos;s threshold yet — that&apos;s expected, not a bug.
        </p>
        {msg && <div className="alert success">{msg}</div>}
        {err && <div className="alert error">{err}</div>}
      </div>
    </div>
  );
}

function CompositionCard({ topics }: { topics: Topic[] }) {
  const [topicUri, setTopicUri] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    satisfied: boolean;
    op: string;
    children: Array<{ uri: string; kind: string; matched: boolean }>;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!topicUri && topics[0]) setTopicUri(topics[0].uri);
  }, [topics, topicUri]);

  async function submit() {
    setErr(null);
    setResult(null);
    if (!topicUri) {
      setErr("Create a composition topic first.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.evaluateComposition(topicUri);
      setResult(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Evaluate composition</h2>
      <div className="form">
        <label>
          Composition topic
          <select value={topicUri} onChange={(e) => setTopicUri(e.target.value)}>
            {topics.length === 0 && <option value="">No COMPOSITION topics yet</option>}
            {topics.map((t) => (
              <option key={t.id} value={t.uri}>
                {t.uri}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" onClick={submit} disabled={busy || !topics.length}>
          {busy ? "Evaluating…" : "Evaluate"}
        </button>
        {err && <div className="alert error">{err}</div>}
        {result && (
          <>
            <div className={`alert ${result.satisfied ? "success" : "error"}`}>
              {result.op.toUpperCase()} composition {result.satisfied ? "satisfied" : "not satisfied"}
            </div>
            <div className="list">
              {result.children.map((c) => (
                <div key={c.uri} className="list-item">
                  <header>
                    <span className={`pill ${c.matched ? "success" : "warn"}`}>
                      {c.matched ? "matched" : "unmatched"}
                    </span>
                    <span className="muted">{c.kind}</span>
                  </header>
                  <div className="mono">{c.uri}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AddressValidityCard() {
  const [address, setAddress] = useState("rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    setErr(null);
    setBusy(true);
    try {
      const res = await api.liveFdcAddressValidity(address.trim() || undefined);
      if (res.error) {
        setErr(res.error);
      } else {
        setMsg(
          `Prepare status: ${res.prepare?.status ?? "unknown"}${res.casidEvent ? ` — event ${res.casidEvent.proofHash.slice(0, 16)}… recorded` : ""}`,
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Live address validity (FDC)</h2>
      <div className="form">
        <label>
          Address
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="mono" />
        </label>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? "Checking…" : "Prepare AddressValidity"}
        </button>
        <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
          Calls Flare&apos;s real testnet FDC verifier to prepare (not submit) an AddressValidity
          request — no gas required.
        </p>
        {msg && <div className="alert success">{msg}</div>}
        {err && <div className="alert error">{err}</div>}
      </div>
    </div>
  );
}
