"use client";

import { useEffect, useState } from "react";
import { api, type CasidEvent, type Delivery } from "@/lib/api";

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
        <h1>Proof explorer</h1>
        <p>
          Every delivery is gated on a verified event commitment. Webhooks carry{" "}
          <code className="mono">X-Casid-Signature</code> (HMAC-SHA256) so
          consumers can trust the payload without trusting Casid alone.
        </p>
      </section>

      {err && <div className="alert error">{err}</div>}

      <h2 className="section-title">Events</h2>
      <div className="list">
        {events.map((e) => (
          <div key={e.id} className="list-item">
            <header>
              <span className="pill success">{e.attestationType}</span>
              <span className="muted">{new Date(e.createdAt).toLocaleString()}</span>
            </header>
            <div className="mono">{e.topicUri}</div>
            <div className="muted" style={{ marginTop: 8, fontSize: "0.82rem" }}>
              proofHash
            </div>
            <div className="mono">{e.proofHash}</div>
            <div className="muted" style={{ marginTop: 8, fontSize: "0.82rem" }}>
              payload
            </div>
            <pre
              className="mono"
              style={{
                margin: "6px 0 0",
                whiteSpace: "pre-wrap",
                color: "var(--muted)",
              }}
            >
              {JSON.stringify(e.payload, null, 2)}
            </pre>
          </div>
        ))}
        {events.length === 0 && (
          <div className="card muted">No events yet. Run the demo from the console.</div>
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
                <td className="mono">{d.eventId.slice(0, 8)}…</td>
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
