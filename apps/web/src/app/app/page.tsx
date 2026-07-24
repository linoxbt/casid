"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type CasidEvent, type Delivery, type Topic } from "@/lib/api";

function short(value?: string | null, size = 10) {
  if (!value) return "-";
  return value.length > size * 2 ? `${value.slice(0, size)}...${value.slice(-6)}` : value;
}

function explorerHref(event: CasidEvent) {
  const candidate = event.payload.submitTx ?? event.payload.txHash ?? event.payload.onChainTx;
  return typeof candidate === "string" && candidate.startsWith("0x")
    ? `https://coston2-explorer.flare.network/tx/${candidate}`
    : `https://coston2-explorer.flare.network/search-results?q=${encodeURIComponent(event.proofHash)}`;
}

export default function HomePage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [events, setEvents] = useState<CasidEvent[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [activeTab, setActiveTab] = useState("topics");
  const [network, setNetwork] = useState("resolving");
  const [health, setHealth] = useState("checking");
  const [paymentTopic, setPaymentTopic] = useState("");
  const [ftsoTopic, setFtsoTopic] = useState("");
  const [subscriptionTopic, setSubscriptionTopic] = useState("");
  const [newPaymentChain, setNewPaymentChain] = useState("xrp");
  const [newPaymentDestination, setNewPaymentDestination] = useState("");
  const [customTopicUri, setCustomTopicUri] = useState("topic://ftso/price/XRP-USD/threshold/gte/0.50");
  const [txHash, setTxHash] = useState("");
  const [amount, setAmount] = useState("");
  const [webhook, setWebhook] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paymentTopics = useMemo(() => topics.filter((t) => t.kind === "PAYMENT"), [topics]);
  const ftsoTopics = useMemo(() => topics.filter((t) => t.kind === "FTSO_THRESHOLD"), [topics]);
  const delivered = deliveries.filter((d) => d.status === "delivered").length;

  const refresh = useCallback(async () => {
    try {
      const [h, t, e, d, m] = await Promise.all([
        api.health(),
        api.topics(),
        api.events(),
        api.deliveries(),
        api.meta().catch(() => null),
      ]);
      setHealth(h.ok ? "online" : "degraded");
      setTopics(t.topics);
      setEvents(e.events);
      setDeliveries(d.deliveries);
      setNetwork(m ? `${m.network.name ?? "flare"} / ${m.network.chainId}` : "offline");
      setPaymentTopic((current) => current || t.topics.find((topic) => topic.kind === "PAYMENT")?.uri || "");
      setFtsoTopic((current) => current || t.topics.find((topic) => topic.kind === "FTSO_THRESHOLD")?.uri || "");
      setSubscriptionTopic((current) => current || t.topics[0]?.uri || "");
      setError(null);
    } catch (err) {
      setHealth("offline");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  async function createTopic(uri: string) {
    const trimmed = uri.trim();
    if (!trimmed) return setError("Enter a topic URI before creating it.");
    setBusy("topic");
    setError(null);
    try {
      const res = await api.createTopic(trimmed);
      setNotice(`Topic created: ${res.topic.uri}`);
      if (res.topic.kind === "PAYMENT") setPaymentTopic(res.topic.uri);
      if (res.topic.kind === "FTSO_THRESHOLD") setFtsoTopic(res.topic.uri);
      setSubscriptionTopic(res.topic.uri);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function createPaymentTopic() {
    if (!newPaymentDestination.trim()) return setError("Enter the destination address for this payment topic.");
    await createTopic(`topic://payment/${newPaymentChain}/${newPaymentDestination.trim()}`);
  }

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 6000);
    return () => clearInterval(id);
  }, [refresh]);

  async function subscribe() {
    if (!subscriptionTopic) return setError("Select a topic before subscribing.");
    if (!webhook.trim()) return setError("Webhook URL is required.");
    setBusy("subscribe");
    setError(null);
    try {
      const res = await api.subscribe({ topicUri: subscriptionTopic, webhookUrl: webhook.trim() });
      setNotice(`Subscription ${short(res.subscription.id)} is active for ${subscriptionTopic.replace("topic://", "")}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function attestPayment() {
    if (!paymentTopic) return setError("Select a payment topic.");
    if (!txHash.trim()) return setError("A real source-chain transaction id is required.");
    setBusy("payment");
    setError(null);
    setNotice("Submitting FDC Payment request. This can take multiple voting rounds.");
    try {
      const res = await api.attestPayment({
        topicUri: paymentTopic,
        txHash: txHash.trim(),
        amount: amount.trim() || undefined,
        fireOnChain: true,
      });
      setNotice(`Payment proof accepted. Event ${short(res.event.id)} recorded; ${res.deliveries.length} delivery attempt(s).`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function attestFtso() {
    if (!ftsoTopic) return setError("Select an FTSO topic.");
    setBusy("ftso");
    setError(null);
    try {
      const res = await api.attestFtso({ topicUri: ftsoTopic, fireOnChain: true });
      setNotice(`FTSO threshold verified at ${res.observedPrice}. Event ${short(res.event.id)} recorded.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="console-page">
      <section className="hero hero-console compact-hero">
        <div className="eyebrow">Verified economic event fabric</div>
        <h1>Operations console</h1>
        <p>
          Start by creating a payment topic in Topics, subscribe an HTTPS webhook, then submit a real
          source-chain transaction id for FDC verification. FTSO topics can be verified directly from live feeds.
        </p>
        <div className="status-strip" aria-label="System status">
          <span><strong>{health}</strong> coordinator</span>
          <span><strong>{network}</strong> network</span>
          <span><strong>{events.length}</strong> verified events</span>
          <span><strong>{delivered}</strong> delivered webhooks</span>
        </div>
      </section>

      {(notice || error) && (
        <div className={`alert ${error ? "error" : "success"}`}>{error ?? notice}</div>
      )}

      <div className="tab-bar" role="tablist" aria-label="Operations sections">
        {[
          ["topics", "Create topic"],
          ["payment", "FDC Payment"],
          ["ftso", "FTSO"],
          ["webhook", "Webhook"],
          ["ledger", "Event ledger"],
          ["delivery", "Delivery health"],
        ].map(([id, label]) => (
          <button
            className={`tab-button ${activeTab === id ? "active" : ""}`}
            key={id}
            onClick={() => setActiveTab(id)}
            role="tab"
            aria-selected={activeTab === id}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "topics" && (
        <section className="tab-panel grid cols-2">
          <div className="panel panel-command">
            <div className="panel-heading">
              <span>Create payment topic</span>
              <span className="pill">FDC</span>
            </div>
            <label>
              Source chain
              <select value={newPaymentChain} onChange={(e) => setNewPaymentChain(e.target.value)}>
                <option value="xrp">XRPL</option>
                <option value="btc">BTC</option>
                <option value="doge">DOGE</option>
              </select>
            </label>
            <label>
              Destination address
              <input
                value={newPaymentDestination}
                onChange={(e) => setNewPaymentDestination(e.target.value)}
                placeholder="Paste the address your system watches"
              />
            </label>
            <div className="quiet-box mono">
              topic://payment/{newPaymentChain}/{newPaymentDestination || "destination"}
            </div>
            <button className="btn btn-primary" disabled={busy === "topic"} onClick={createPaymentTopic}>
              {busy === "topic" ? "Creating topic..." : "Create payment topic"}
            </button>
          </div>

          <div className="panel panel-command">
            <div className="panel-heading">
              <span>Create custom topic</span>
              <span className="pill success">URI</span>
            </div>
            <label>
              Topic URI
              <input value={customTopicUri} onChange={(e) => setCustomTopicUri(e.target.value)} />
            </label>
            <div className="quiet-box">
              Use this for FTSO thresholds, FAsset lifecycle topics, compositions, or advanced topic URIs.
            </div>
            <button className="btn btn-ghost" disabled={busy === "topic"} onClick={() => void createTopic(customTopicUri)}>
              {busy === "topic" ? "Creating topic..." : "Create custom topic"}
            </button>
          </div>

          <div className="panel wide tab-span">
            <div className="panel-heading"><span>Available topics</span><span>{topics.length}</span></div>
            <div className="list compact-list">
              {topics.map((topic) => (
                <button
                  className="list-item selectable-item"
                  key={topic.id}
                  onClick={() => {
                    setSubscriptionTopic(topic.uri);
                    if (topic.kind === "PAYMENT") setPaymentTopic(topic.uri);
                    if (topic.kind === "FTSO_THRESHOLD") setFtsoTopic(topic.uri);
                  }}
                >
                  <span className="pill">{topic.kind}</span>
                  <span className="mono">{topic.uri}</span>
                </button>
              ))}
              {topics.length === 0 && <div className="muted">No topics yet.</div>}
            </div>
          </div>
        </section>
      )}

      {activeTab === "payment" && (
        <section className="tab-panel">
          <div className="panel panel-command focused-panel">
          <div className="panel-heading">
            <span>FDC Payment</span>
            <span className="pill">Live proof</span>
          </div>
          <label>
            Payment topic
            <select value={paymentTopic} onChange={(e) => setPaymentTopic(e.target.value)}>
              <option value="">Select a payment topic</option>
              {paymentTopics.map((topic) => <option key={topic.id} value={topic.uri}>{topic.uri}</option>)}
            </select>
          </label>
          {paymentTopics.length === 0 && (
            <div className="quiet-box">No payment topics exist yet. Open the Create topic tab and enter a destination address first.</div>
          )}
          <label>
            Source transaction id
            <input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="XRPL/BTC/DOGE transaction hash" />
          </label>
          <label>
            Amount filter
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="smallest units, optional" />
          </label>
          <button className="btn btn-primary" disabled={busy === "payment"} onClick={attestPayment}>
            {busy === "payment" ? "Submitting proof..." : "Submit FDC proof"}
          </button>
          </div>
        </section>
      )}

      {activeTab === "ftso" && (
        <section className="tab-panel">
          <div className="panel panel-command focused-panel">
          <div className="panel-heading">
            <span>FTSO Threshold</span>
            <span className="pill success">Live feed</span>
          </div>
          <label>
            Price topic
            <select value={ftsoTopic} onChange={(e) => setFtsoTopic(e.target.value)}>
              <option value="">Select an FTSO topic</option>
              {ftsoTopics.map((topic) => <option key={topic.id} value={topic.uri}>{topic.uri}</option>)}
            </select>
          </label>
          <div className="quiet-box">
            Reads the configured Flare feed, evaluates the topic threshold, records a verified event,
            then fans out subscribed destinations.
          </div>
          <button className="btn btn-ghost" disabled={busy === "ftso"} onClick={attestFtso}>
            {busy === "ftso" ? "Reading feed..." : "Verify threshold"}
          </button>
          </div>
        </section>
      )}

      {activeTab === "webhook" && (
        <section className="tab-panel">
          <div className="panel panel-command focused-panel">
          <div className="panel-heading">
            <span>Webhook Sink</span>
            <span className="pill">HMAC</span>
          </div>
          <label>
            Topic
            <select value={subscriptionTopic} onChange={(e) => setSubscriptionTopic(e.target.value)}>
              <option value="">Select a topic to subscribe</option>
              {topics.map((topic) => <option key={topic.id} value={topic.uri}>[{topic.kind}] {topic.uri}</option>)}
            </select>
          </label>
          <label>
            Destination URL
            <input value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://your-service.example/casid" />
          </label>
          <div className="quiet-box">
            HTTPS destinations receive signed payloads with event commitments, proof hashes, and delivery metadata.
          </div>
          <button className="btn btn-ghost" disabled={busy === "subscribe"} onClick={subscribe}>
            {busy === "subscribe" ? "Subscribing..." : "Create subscription"}
          </button>
          </div>
        </section>
      )}

      {activeTab === "ledger" && (
        <section className="tab-panel ledger-grid single-ledger">
        <div className="panel wide">
          <div className="panel-heading">
            <span>Event ledger</span>
            <button className="text-button" onClick={() => void refresh()}>Refresh</button>
          </div>
          <table>
            <thead>
              <tr><th>Time</th><th>Type</th><th>Topic</th><th>Proof</th><th>Status</th></tr>
            </thead>
            <tbody>
              {events.slice(0, 8).map((event) => (
                <tr key={event.id}>
                  <td className="muted">{new Date(event.createdAt).toLocaleTimeString()}</td>
                  <td><span className="pill success">{event.attestationType}</span></td>
                  <td className="mono">{short(event.topicUri.replace("topic://", ""), 18)}</td>
                  <td className="mono">
                    <a className="proof-link" href={explorerHref(event)} target="_blank" rel="noreferrer">
                      {short(event.proofHash, 8)}
                    </a>
                  </td>
                  <td>{event.verified ? "verified" : "pending"}</td>
                </tr>
              ))}
              {events.length === 0 && <tr><td colSpan={5} className="muted">No proof-backed events recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
        </section>
      )}

      {activeTab === "delivery" && (
        <section className="tab-panel">
        <div className="panel">
          <div className="panel-heading"><span>Delivery health</span><span>{deliveries.length}</span></div>
          <div className="delivery-list">
            {deliveries.slice(0, 6).map((delivery) => (
              <div className="delivery-row" key={delivery.id}>
                <span className={`dot ${delivery.status === "delivered" ? "ok" : "warn"}`} />
                <span>{delivery.status}</span>
                <span className="mono">{short(delivery.eventId, 6)}</span>
              </div>
            ))}
            {deliveries.length === 0 && <div className="muted">No deliveries yet.</div>}
          </div>
        </div>
      </section>
      )}
    </div>
  );
}
