"use client";

import Link from "next/link";
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

export default function DashboardPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [events, setEvents] = useState<CasidEvent[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [health, setHealth] = useState("checking");
  const [network, setNetwork] = useState("resolving");
  const [eventsTotal, setEventsTotal] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paymentTopic = useMemo(() => topics.find((topic) => topic.kind === "PAYMENT")?.uri ?? "", [topics]);
  const ftsoTopic = useMemo(() => topics.find((topic) => topic.kind === "FTSO_THRESHOLD")?.uri ?? "", [topics]);
  const delivered = deliveries.filter((d) => d.status === "delivered").length;

  const refresh = useCallback(async () => {
    try {
      // Preview tables only need a handful of rows; the stat counts come
      // from the coordinator's own totals rather than the length of the
      // fetched preview slice.
      const [h, t, e, d, m] = await Promise.all([
        api.health(),
        api.topics(),
        api.events(5),
        api.deliveries(),
        api.meta().catch(() => null),
      ]);
      setHealth(h.ok ? "online" : "degraded");
      setEventsTotal(h.events);
      setTopics(t.topics);
      setEvents(e.events);
      setDeliveries(d.deliveries);
      setNetwork(m ? `${m.network.name ?? "flare"} / ${m.network.chainId}` : "offline");
      setError(null);
    } catch (err) {
      setHealth("offline");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 6000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="dashboard-home">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Verified economic event fabric</p>
          <h1>Operations console</h1>
          <p>
            Create a topic, submit a proof, or inspect the ledger. The detailed flows live in the sidebar sections;
            this page stays focused on live status and the next action.
          </p>
        </div>

        <div className="status-panel">
          <div>
            <strong>{health}</strong>
            <span>coordinator</span>
          </div>
          <div>
            <strong>{network}</strong>
            <span>network</span>
          </div>
          <div>
            <strong>{eventsTotal}</strong>
            <span>verified events</span>
          </div>
          <div>
            <strong>{delivered}</strong>
            <span>delivered webhooks</span>
          </div>
        </div>
      </section>

      {(notice || error) && <div className={`alert ${error ? "error" : "success"}`}>{error ?? notice}</div>}

      <section className="dashboard-grid">
        <article className="surface-card">
          <p className="surface-label">next step</p>
          <h2>Open the topic workflow</h2>
          <p>Create a payment topic or a live FTSO topic from the sidebar section.</p>
          <Link className="site-link" href="/app/topics">Go to Topics</Link>
        </article>
        <article className="surface-card">
          <p className="surface-label">current defaults</p>
          <h2>Selected topics</h2>
          <p className="mono">{paymentTopic || "No payment topic yet"}</p>
          <p className="mono">{ftsoTopic || "No FTSO topic yet"}</p>
        </article>
        <article className="surface-card">
          <p className="surface-label">docs</p>
          <h2>Understand the flow</h2>
          <p>Read how Casid wires proofs, webhooks, and on-chain triggers together.</p>
          <Link className="site-link" href="/app/docs">Open docs</Link>
        </article>
      </section>

      <section className="dashboard-lane">
        <div className="panel">
          <div className="panel-heading">
            <span>Event ledger</span>
            <Link className="site-link" href="/app/events">View all</Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Proof</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="muted">{new Date(event.createdAt).toLocaleTimeString()}</td>
                  <td><span className="pill success">{event.attestationType}</span></td>
                  <td className="mono">
                    <a className="proof-link" href={explorerHref(event)} target="_blank" rel="noreferrer">
                      {short(event.proofHash, 8)}
                    </a>
                  </td>
                  <td>{event.verified ? "verified" : "pending"}</td>
                </tr>
              ))}
              {events.length === 0 && <tr><td colSpan={4} className="muted">No proof-backed events recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <span>Delivery health</span>
            <Link className="site-link" href="/app/events">Inspect</Link>
          </div>
          <div className="delivery-list">
            {deliveries.slice(0, 5).map((delivery) => (
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
    </div>
  );
}
