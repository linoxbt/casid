"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type CasidEvent, type Subscription, type Topic } from "@/lib/api";
import { eventTxHash, explorerTxHref, topicExplorerHref } from "@/lib/onchain";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function TopicDetailPage() {
  const params = useParams<{ id: string }>();
  const [topic, setTopic] = useState<Topic | null | undefined>(undefined);
  const [pipeline, setPipeline] = useState<string[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [events, setEvents] = useState<CasidEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [t, subs, evts] = await Promise.all([
          api.topic(params.id),
          api.subscriptions(),
          api.events(200),
        ]);
        if (cancelled) return;
        setTopic(t.topic);
        setPipeline(t.pipeline);
        setSubscriptions(subs.subscriptions.filter((s) => s.topicUri === t.topic.uri));
        setEvents(evts.events.filter((e) => e.topicUri === t.topic.uri));
        setErr(null);
      } catch (e) {
        if (!cancelled) {
          setTopic(null);
          setErr(e instanceof Error ? e.message : String(e));
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (topic === undefined) {
    return (
      <>
        <Link href="/app/topics" className="site-link">← Topics</Link>
        <p className="muted" style={{ marginTop: "1rem" }}>Loading…</p>
      </>
    );
  }

  if (topic === null) {
    return (
      <>
        <Link href="/app/topics" className="site-link">← Topics</Link>
        <div className="alert error" style={{ marginTop: "1rem" }}>
          {err ?? "Topic not found."}
        </div>
      </>
    );
  }

  const explorerHref = topicExplorerHref();

  return (
    <>
      <Link href="/app/topics" className="site-link">← Topics</Link>

      <section className="hero">
        <h1 className="mono" style={{ fontSize: "1.3rem", wordBreak: "break-all" }}>
          {topic.uri}
        </h1>
      </section>

      <div className="page-header-actions" style={{ marginBottom: "1.5rem" }}>
        <span className="pill">{topic.kind}</span>
        <span className={`pill ${topic.active ? "success" : ""}`}>
          {topic.active ? "active" : "inactive"}
        </span>
        {topic.onChainId != null ? (
          explorerHref ? (
            <a className="pill success" href={explorerHref} target="_blank" rel="noreferrer">
              on-chain · id {topic.onChainId} ↗
            </a>
          ) : (
            <span className="pill success">on-chain · id {topic.onChainId}</span>
          )
        ) : (
          <span className="pill">off-chain only</span>
        )}
        {topic.createdBy && (
          <span className="pill mono" title={topic.createdBy}>
            by {shortAddr(topic.createdBy)}
          </span>
        )}
      </div>

      <h2 className="section-title">Attestation pipeline</h2>
      <div className="card">
        <ol className="pipeline">
          {pipeline.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <h2 className="section-title">Subscriptions ({subscriptions.length})</h2>
      <div className="list">
        {subscriptions.map((s) => (
          <div key={s.id} className="list-item">
            <header>
              <span className="pill">{s.webhookUrl ? "webhook" : "on-chain only"}</span>
              <span className={`pill ${s.active ? "success" : ""}`}>
                {s.active ? "active" : "inactive"}
              </span>
            </header>
            {s.webhookUrl && <div className="muted mono">{s.webhookUrl}</div>}
            {s.targetAddress && <div className="muted mono">{s.targetAddress}</div>}
          </div>
        ))}
        {subscriptions.length === 0 && <div className="card muted">No subscriptions on this topic.</div>}
      </div>

      <h2 className="section-title">Events ({events.length})</h2>
      <div className="list">
        {events.map((e) => {
          const tx = eventTxHash(e);
          return (
            <Link key={e.id} href={`/app/events/${e.id}`} className="list-item card-hover">
              <header>
                <span className="pill success">{e.attestationType}</span>
                <span className="muted">{new Date(e.createdAt).toLocaleString()}</span>
              </header>
              <div className="mono" style={{ wordBreak: "break-all" }}>{e.proofHash}</div>
              {tx && (
                <div style={{ marginTop: "0.4rem" }}>
                  <a
                    className="proof-link mono"
                    style={{ fontSize: "0.76rem" }}
                    href={explorerTxHref(tx)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    view on-chain tx ↗
                  </a>
                </div>
              )}
            </Link>
          );
        })}
        {events.length === 0 && <div className="card muted">No events recorded for this topic yet.</div>}
      </div>
    </>
  );
}
