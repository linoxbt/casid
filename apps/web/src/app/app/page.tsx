"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, type CasidEvent, type Delivery } from "@/lib/api";
import { TopicsIcon, VerifyIcon, DocsIcon } from "@/components/app-sidebar";
import { isOnChain } from "@/lib/onchain";

function short(value?: string | null, size = 10) {
  if (!value) return "-";
  return value.length > size * 2 ? `${value.slice(0, size)}...${value.slice(-6)}` : value;
}

export default function DashboardPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CasidEvent[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [health, setHealth] = useState("checking");
  const [network, setNetwork] = useState("resolving");
  const [eventsTotal, setEventsTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const delivered = deliveries.filter((d) => d.status === "delivered").length;

  const refresh = useCallback(async () => {
    try {
      const [h, e, d, m] = await Promise.all([
        api.health(),
        api.events(5),
        api.deliveries(),
        api.meta().catch(() => null),
      ]);
      setHealth(h.ok ? "online" : "degraded");
      setEventsTotal(h.events);
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

  const isOnline = health === "online";

  return (
    <div className="dashboard-home">
      <div className="page-header">
        <div>
          <p className="page-header-eyebrow">Overview</p>
          <h1>Dashboard</h1>
        </div>
        <div className="page-header-actions">
          <span className={`status-badge ${isOnline ? "ok" : "down"}`}>
            <span className={`status-dot ${isOnline ? "ok" : "down"}`} />
            {health}
          </span>
          <Link className="btn btn-primary" href="/app/verify">Verify a payment</Link>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="stat-row">
        <div className="stat-card">
          <span className="stat-card-label">Network</span>
          <span className="stat-card-value" style={{ fontSize: "1.05rem" }}>{network}</span>
        </div>
        <div className="stat-card accent-green">
          <span className="stat-card-label">Verified events</span>
          <span className="stat-card-value">{eventsTotal}</span>
        </div>
        <div className="stat-card accent-violet">
          <span className="stat-card-label">Delivered webhooks</span>
          <span className="stat-card-value">{delivered}</span>
        </div>
        <div className="stat-card accent-warn">
          <span className="stat-card-label">Pending deliveries</span>
          <span className="stat-card-value">{deliveries.length - delivered}</span>
        </div>
      </div>

      <div className="quick-actions">
        <Link className="action-tile" href="/app/topics">
          <TopicsIcon />
          New topic
        </Link>
        <Link className="action-tile" href="/app/verify">
          <VerifyIcon />
          Verify a proof
        </Link>
        <Link className="action-tile" href="/app/docs">
          <DocsIcon />
          Read the docs
        </Link>
      </div>

      <section className="dashboard-lane">
        <div className="panel">
          <div className="panel-heading">
            <span>Event ledger</span>
            <Link className="site-link" href="/app/events">View all</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Proof</th>
                  <th>On-chain</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr
                    key={event.id}
                    onClick={() => router.push(`/app/events/${event.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className="muted">{new Date(event.createdAt).toLocaleTimeString()}</td>
                    <td><span className="pill success">{event.attestationType}</span></td>
                    <td className="mono">
                      <Link
                        className="proof-link"
                        href={`/app/events/${event.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {short(event.proofHash, 8)}
                      </Link>
                    </td>
                    <td>
                      <span className={`pill ${isOnChain(event) ? "success" : ""}`}>
                        {isOnChain(event) ? "on-chain" : "off-chain"}
                      </span>
                    </td>
                    <td>
                      <span className="pill success">
                        <span className="status-dot ok" />
                        {event.verified ? "verified" : "pending"}
                      </span>
                    </td>
                  </tr>
                ))}
                {events.length === 0 && <tr><td colSpan={5} className="muted">No proof-backed events recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <span>Delivery activity</span>
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
