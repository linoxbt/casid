"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type CasidEvent, type Delivery } from "@/lib/api";
import { eventTxHash, explorerTxHref, explorerSearchHref } from "@/lib/onchain";

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const [event, setEvent] = useState<CasidEvent | null | undefined>(undefined);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [e, d] = await Promise.all([api.events(200), api.deliveries(200)]);
        if (cancelled) return;
        const match = e.events.find((ev) => ev.id === params.id) ?? null;
        setEvent(match);
        setDeliveries(d.deliveries.filter((del) => del.eventId === params.id));
        setErr(null);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (err) {
    return (
      <>
        <Link href="/app/events" className="site-link">← Events</Link>
        <div className="alert error" style={{ marginTop: "1rem" }}>{err}</div>
      </>
    );
  }

  if (event === undefined) {
    return (
      <>
        <Link href="/app/events" className="site-link">← Events</Link>
        <p className="muted" style={{ marginTop: "1rem" }}>Loading…</p>
      </>
    );
  }

  if (event === null) {
    return (
      <>
        <Link href="/app/events" className="site-link">← Events</Link>
        <div className="alert error" style={{ marginTop: "1rem" }}>
          Event not found. It may be older than the last 200 recorded events, or the coordinator
          was redeployed since it was created (no persistent volume — see docs).
        </div>
      </>
    );
  }

  const txHash = eventTxHash(event);

  return (
    <>
      <Link href="/app/events" className="site-link">← Events</Link>

      <section className="hero">
        <h1 className="mono" style={{ fontSize: "1.5rem", wordBreak: "break-all" }}>
          Event {event.id.slice(0, 8)}…
        </h1>
        <p>{new Date(event.createdAt).toLocaleString()}</p>
      </section>

      <div className="page-header-actions" style={{ marginBottom: "1.5rem" }}>
        <span className="pill success">{event.attestationType}</span>
        <span className={`pill ${event.verified ? "success" : "warn"}`}>
          {event.verified ? "verified" : "pending"}
        </span>
        {txHash ? (
          <a
            className="pill success"
            href={explorerTxHref(txHash)}
            target="_blank"
            rel="noreferrer"
          >
            on-chain ↗
          </a>
        ) : (
          <span className="pill">off-chain only</span>
        )}
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Topic</h2>
          <p className="mono" style={{ margin: "0.5rem 0 0", wordBreak: "break-all" }}>
            {event.topicId ? (
              <Link href={`/app/topics/${event.topicId}`} className="proof-link">
                {event.topicUri}
              </Link>
            ) : (
              event.topicUri
            )}
          </p>
        </div>
        <div className="card">
          <h2>Proof</h2>
          <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.8rem" }}>proof hash</p>
          <p className="mono" style={{ margin: "0.2rem 0 0", wordBreak: "break-all" }}>
            <a
              className="proof-link"
              href={txHash ? explorerTxHref(txHash) : explorerSearchHref(event.proofHash)}
              target="_blank"
              rel="noreferrer"
            >
              {event.proofHash}
            </a>
          </p>
          <p className="muted" style={{ margin: "0.6rem 0 0", fontSize: "0.8rem" }}>event commitment</p>
          <p className="mono" style={{ margin: "0.2rem 0 0", wordBreak: "break-all" }}>
            {event.eventCommitment}
          </p>
        </div>
      </div>

      <h2 className="section-title">Payload</h2>
      <div className="card">
        <pre className="mono" style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--muted)" }}>
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      </div>

      <h2 className="section-title">Deliveries</h2>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Attempts</th>
              <th>Signature</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id}>
                <td>
                  <span className={`pill ${d.status === "delivered" ? "success" : "warn"}`}>
                    {d.status}
                  </span>
                </td>
                <td>{d.attempts}</td>
                <td className="mono">{d.signature ? `${d.signature.slice(0, 28)}…` : "—"}</td>
                <td className="muted">{d.lastError ?? "—"}</td>
              </tr>
            ))}
            {deliveries.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">No deliveries for this event.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
