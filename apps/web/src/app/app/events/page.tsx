"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type CasidEvent, type Delivery } from "@/lib/api";
import { isOnChain } from "@/lib/onchain";

export default function EventsPage() {
  const [events, setEvents] = useState<CasidEvent[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [e, d] = await Promise.all([api.events(), api.deliveries()]);
        setEvents(e.events);
        setDeliveries(d.deliveries);
        setErr(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    }
    void load();
    const id = setInterval(() => void load(), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <section className="hero">
        <h1>Event ledger</h1>
        <p>Every verified fact, with its proof and delivery status.</p>
      </section>

      {err && <div className="alert error">{err}</div>}

      <h2 className="section-title">Events</h2>
      <div className="list">
        {events.map((e) => (
          <Link key={e.id} href={`/app/events/${e.id}`} className="list-item card-hover">
            <header>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <span className="pill success">{e.attestationType}</span>
                <span className={`pill ${isOnChain(e) ? "success" : ""}`}>
                  {isOnChain(e) ? "on-chain" : "off-chain"}
                </span>
              </div>
              <span className="muted">{new Date(e.createdAt).toLocaleString()}</span>
            </header>
            <div className="mono">{e.topicUri}</div>
            <div className="muted" style={{ marginTop: 8, fontSize: "0.82rem" }}>
              proof commitment
            </div>
            <div className="mono" style={{ wordBreak: "break-all" }}>{e.proofHash}</div>
          </Link>
        ))}
        {events.length === 0 && (
          <div className="card muted">No events yet. Submit a finalized FDC Payment proof or verify an FTSO threshold.</div>
        )}
      </div>

      <h2 className="section-title">Deliveries</h2>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Event</th>
              <th>Attempts</th>
              <th>Signature</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id}>
                <td>
                  <span
                    className={`pill ${d.status === "delivered" ? "success" : "warn"}`}
                  >
                    {d.status}
                  </span>
                </td>
                <td className="mono">
                  <Link href={`/app/events/${d.eventId}`} className="proof-link">
                    {d.eventId.slice(0, 8)}…
                  </Link>
                </td>
                <td>{d.attempts}</td>
                <td className="mono">
                  {d.signature ? `${d.signature.slice(0, 28)}…` : "—"}
                </td>
                <td className="muted">{d.lastError ?? "—"}</td>
              </tr>
            ))}
            {deliveries.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No deliveries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
