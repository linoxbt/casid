"use client";

import { useEffect, useState } from "react";
import { api, type Topic } from "@/lib/api";

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [uri, setUri] = useState("topic://payment/xrp/rYourDestinationHere");
  const [webhook, setWebhook] = useState("casid://log");
  const [selected, setSelected] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const res = await api.topics();
      setTopics(res.topics);
      if (!selected && res.topics[0]) setSelected(res.topics[0].uri);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createTopic() {
    setMsg(null);
    setErr(null);
    try {
      const res = await api.createTopic(uri.trim());
      setMsg(`Topic ready: ${res.topic.uri}`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function subscribe() {
    setMsg(null);
    setErr(null);
    try {
      const res = await api.subscribe({
        topicUri: selected,
        webhookUrl: webhook.trim(),
      });
      setMsg(`Subscribed ${res.subscription.id.slice(0, 8)}… → ${webhook}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const active = topics.find((t) => t.uri === selected);

  return (
    <>
      <section className="hero">
        <h1>Topic designer</h1>
        <p>
          Define durable economic topics. Leaf topics map to FDC attestation
          types or FTSO feeds. Compositions combine them with AND/OR algebra.
        </p>
      </section>

      {msg && <div className="alert success">{msg}</div>}
      {err && <div className="alert error">{err}</div>}

      <div className="grid cols-2">
        <div className="card">
          <h2>Register topic URI</h2>
          <div className="form">
            <label>
              Topic URI
              <input value={uri} onChange={(e) => setUri(e.target.value)} />
            </label>
            <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
              Examples:{" "}
              <code className="mono">topic://payment/xrp/{"{addr}"}</code>,{" "}
              <code className="mono">
                topic://ftso/price/XRP-USD/threshold/gte/0.50
              </code>
            </p>
            <button className="btn btn-primary" onClick={createTopic}>
              Create topic
            </button>
          </div>
        </div>

        <div className="card">
          <h2>Subscribe (webhook)</h2>
          <div className="form">
            <label>
              Topic
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.uri}>
                    [{t.kind}] {t.uri}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Webhook URL
              <input
                value={webhook}
                onChange={(e) => setWebhook(e.target.value)}
                placeholder="https://… or casid://log"
              />
            </label>
            <button className="btn btn-primary" onClick={subscribe}>
              Subscribe
            </button>
          </div>
        </div>
      </div>

      <h2 className="section-title">Attestation pipeline</h2>
      <div className="card">
        {active ? (
          <>
            <div className="mono" style={{ marginBottom: 12 }}>
              {active.uri}
            </div>
            <ol className="pipeline">
              {(active.pipeline ?? []).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </>
        ) : (
          <p className="muted">Select a topic to inspect its Flare pipeline.</p>
        )}
      </div>

      <h2 className="section-title">All topics</h2>
      <div className="list">
        {topics.map((t) => (
          <div
            key={t.id}
            className="list-item"
            style={{ cursor: "pointer" }}
            onClick={() => setSelected(t.uri)}
          >
            <header>
              <span className="pill">{t.kind}</span>
              <span className="muted">
                on-chain id {t.onChainId ?? "—"} · {t.active ? "active" : "off"}
              </span>
            </header>
            <div className="mono">{t.uri}</div>
          </div>
        ))}
      </div>
    </>
  );
}
