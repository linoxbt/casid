"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Topic } from "@/lib/api";
import { validateTxHash } from "@/lib/chain-address";

function useSubmission() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setErr(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, err, setErr, run };
}

function useDefaultTopic(topics: Topic[]) {
  const [topicUri, setTopicUri] = useState("");
  useEffect(() => {
    if (!topicUri && topics[0]) setTopicUri(topics[0].uri);
  }, [topics, topicUri]);
  return [topicUri, setTopicUri] as const;
}

function TopicSelect({
  topics,
  value,
  onChange,
  emptyLabel,
}: {
  topics: Topic[];
  value: string;
  onChange: (v: string) => void;
  emptyLabel: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {topics.length === 0 && <option value="">{emptyLabel}</option>}
      {topics.map((t) => (
        <option key={t.id} value={t.uri}>
          {t.uri}
        </option>
      ))}
    </select>
  );
}

type Tab = "payment" | "ftso" | "composition" | "address";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "payment", label: "Payment proof" },
  { id: "ftso", label: "FTSO threshold" },
  { id: "composition", label: "Composition" },
  { id: "address", label: "Address validity" },
];

export default function VerifyPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("payment");

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
        <p>Submit real proof material and get a verified event back.</p>
      </section>

      {err && <div className="alert error">{err}</div>}

      <div className="tab-bar" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`tab-btn ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 560 }}>
        {tab === "payment" && <PaymentCard topics={paymentTopics} onSettled={load} />}
        {tab === "ftso" && <FtsoCard topics={ftsoTopics} onSettled={load} />}
        {tab === "composition" && <CompositionCard topics={compositionTopics} />}
        {tab === "address" && <AddressValidityCard />}
      </div>
    </>
  );
}

function PaymentCard({ topics, onSettled }: { topics: Topic[]; onSettled: () => void }) {
  const [topicUri, setTopicUri] = useDefaultTopic(topics);
  const [txHash, setTxHash] = useState("");
  const [amount, setAmount] = useState("");
  const [fireOnChain, setFireOnChain] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, err, run } = useSubmission();

  function submit() {
    setMsg(null);
    run(async () => {
      if (!topicUri) throw new Error("Create a payment topic first.");
      const txError = validateTxHash(txHash);
      if (txError) throw new Error(txError);
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
    });
  }

  return (
    <div className="card">
      <h2>Submit payment proof</h2>
      <div className="form">
        <label>
          Payment topic
          <TopicSelect
            topics={topics}
            value={topicUri}
            onChange={setTopicUri}
            emptyLabel="No PAYMENT topics yet"
          />
        </label>
        <label>
          Transaction id
          <input
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="64-character transaction hash — not a wallet address"
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
  const [topicUri, setTopicUri] = useDefaultTopic(topics);
  const [fireOnChain, setFireOnChain] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, err, run } = useSubmission();

  function submit() {
    setMsg(null);
    run(async () => {
      if (!topicUri) throw new Error("Create an FTSO threshold topic first.");
      const res = await api.attestFtso({ topicUri, fireOnChain });
      setMsg(
        `Observed price ${res.observedPrice} crossed the threshold — event ${res.event.proofHash.slice(0, 16)}… recorded (${res.deliveries.length} deliveries).`,
      );
      onSettled();
    });
  }

  return (
    <div className="card">
      <h2>Check FTSO threshold</h2>
      <div className="form">
        <label>
          Price topic
          <TopicSelect
            topics={topics}
            value={topicUri}
            onChange={setTopicUri}
            emptyLabel="No FTSO_THRESHOLD topics yet"
          />
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
          Errors if the price hasn&apos;t crossed yet — expected, not a bug.
        </p>
        {msg && <div className="alert success">{msg}</div>}
        {err && <div className="alert error">{err}</div>}
      </div>
    </div>
  );
}

function CompositionCard({ topics }: { topics: Topic[] }) {
  const [topicUri, setTopicUri] = useDefaultTopic(topics);
  const [result, setResult] = useState<{
    satisfied: boolean;
    op: string;
    children: Array<{ uri: string; kind: string; matched: boolean }>;
  } | null>(null);
  const { busy, err, run } = useSubmission();

  function submit() {
    setResult(null);
    run(async () => {
      if (!topicUri) throw new Error("Create a composition topic first.");
      const res = await api.evaluateComposition(topicUri);
      setResult(res);
    });
  }

  return (
    <div className="card">
      <h2>Evaluate composition</h2>
      <div className="form">
        <label>
          Composition topic
          <TopicSelect
            topics={topics}
            value={topicUri}
            onChange={setTopicUri}
            emptyLabel="No COMPOSITION topics yet"
          />
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
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, err, setErr, run } = useSubmission();

  function submit() {
    setMsg(null);
    run(async () => {
      const res = await api.liveFdcAddressValidity(address.trim() || undefined);
      if (res.error) {
        setErr(res.error);
      } else {
        setMsg(
          `Prepare status: ${res.prepare?.status ?? "unknown"}${res.casidEvent ? ` — event ${res.casidEvent.proofHash.slice(0, 16)}… recorded` : ""}`,
        );
      }
    });
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
          Real testnet verifier call. No gas.
        </p>
        {msg && <div className="alert success">{msg}</div>}
        {err && <div className="alert error">{err}</div>}
      </div>
    </div>
  );
}
