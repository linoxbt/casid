"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Subscription, type Topic } from "@/lib/api";

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [uri, setUri] = useState("topic://payment/xrp/rYourDestinationHere");
  const [webhook, setWebhook] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [topicsRes, subsRes] = await Promise.all([api.topics(), api.subscriptions()]);
      setTopics(topicsRes.topics);
      setSubscriptions(subsRes.subscriptions);
      if (!selected && topicsRes.topics[0]) setSelected(topicsRes.topics[0].uri);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [selected]);

  useEffect(() => {
    void load();
  }, [load]);

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
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function unsubscribe(id: string) {
    setMsg(null);
    setErr(null);
    try {
      await api.unsubscribe(id);
      setMsg(`Unsubscribed ${id.slice(0, 8)}…`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const active = topics.find((t) => t.uri === selected);

  return (
    <>
      <section className="hero">
        <h1>Topics</h1>
        <p>
          Topics are the contract between your application and Casid. Create a payment topic for the
          exact destination you watch, or use price topics for live FTSO thresholds.
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
              Payment topics are not preloaded because the destination address belongs to your system. Examples:{" "}
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
                placeholder="https://your-service.example/casid"
              />
            </label>
            <button className="btn btn-primary" onClick={subscribe}>
              Subscribe
            </button>
          </div>
        </div>
      </div>

      <h2 className="section-title">Active subscriptions</h2>
      <div className="list">
        {subscriptions
          .filter((s) => s.active)
          .map((s) => (
            <div key={s.id} className="list-item">
              <header>
                <span className="pill">{s.webhookUrl ? "webhook" : "on-chain only"}</span>
                <button
                  type="button"
                  className="btn"
                  onClick={() => unsubscribe(s.id)}
                  style={{ marginLeft: "auto" }}
                >
                  Unsubscribe
                </button>
              </header>
              <div className="mono">{s.topicUri}</div>
              {s.webhookUrl && <div className="muted mono">{s.webhookUrl}</div>}
            </div>
          ))}
        {subscriptions.filter((s) => s.active).length === 0 && (
          <div className="card muted">No active subscriptions yet.</div>
        )}
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
