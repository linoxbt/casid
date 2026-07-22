"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type CasidEvent, type Delivery, type Topic } from "@/lib/api";

export default function HomePage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [events, setEvents] = useState<CasidEvent[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [health, setHealth] = useState<string>("checking…");
  const [fdcMode, setFdcMode] = useState<string>("—");
  const [networkName, setNetworkName] = useState<string>("—");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastProof, setLastProof] = useState<string | null>(null);
  const [composition, setComposition] = useState<string | null>(null);

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
      if (m) {
        setFdcMode(m.fdc?.mode ?? "mock");
        setNetworkName(m.network.name ?? `chain ${m.network.chainId}`);
      }
      setError(null);
    } catch (err) {
      setHealth("offline");
      setError(
        err instanceof Error
          ? `${err.message} — start coordinator: bun run dev:coordinator`
          : "Coordinator unreachable",
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [refresh]);

  async function runDemo() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.runDemo();
      setMessage(res.message);
      setLastProof(res.mockProof.slice(0, 96) + "…");
      if (res.composition) {
        setComposition(
          `Composition ${res.composition.op.toUpperCase()}: ${res.composition.satisfied ? "SATISFIED" : "pending children"} (${res.composition.children.length} legs)` +
            (res.onChain?.txHash
              ? ` · on-chain ${res.onChain.txHash.slice(0, 12)}…`
              : res.onChain?.mode
                ? ` · chain ${res.onChain.mode}`
                : ""),
        );
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function firePayment() {
    const payment = topics.find((t) => t.kind === "PAYMENT");
    if (!payment) {
      setError("No payment topic registered");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Ensure subscription for log sink
      await api.subscribe({
        topicUri: payment.uri,
        webhookUrl: "casid://log",
      });
      const res = await api.attestPayment({
        topicUri: payment.uri,
        amount: "10000000",
      });
      setMessage(
        `Verified payment event ${res.event.id.slice(0, 8)}… → ${res.deliveries.length} delivery(ies)`,
      );
      setLastProof(res.event.proofHash);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function liveFdc() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api.liveFdcAddressValidity();
      if (res.error) throw new Error(res.error);
      setMessage(
        `Live FDC prepare: ${res.prepare?.status} — ${res.message ?? "AddressValidity"}`,
      );
      setLastProof(
        res.prepare?.abiEncodedRequest
          ? res.prepare.abiEncodedRequest.slice(0, 96) + "…"
          : null,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function fireFtso() {
    const ftso = topics.find((t) => t.kind === "FTSO_THRESHOLD");
    if (!ftso) {
      setError("No FTSO topic registered");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.subscribe({
        topicUri: ftso.uri,
        webhookUrl: "casid://log",
      });
      const res = await api.attestFtso({
        topicUri: ftso.uri,
        observedPrice: 0.62,
      });
      setMessage(
        `FTSO threshold crossed for ${ftso.uri} → ${res.deliveries.length} delivery(ies)`,
      );
      setLastProof(res.event.proofHash);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="hero">
        <div className="badge-row">
          <span className="badge accent">Flare-native</span>
          <span className="badge">FDC · FTSO · FAssets</span>
          <span className="badge">Coston2-ready</span>
          <span className="badge">Coordinator {health}</span>
          <span className="badge">FDC {fdcMode}</span>
          <span className="badge">{networkName}</span>
          <a className="badge accent" href="/contracts">
            Coston2 verified
          </a>
        </div>
        <h1>
          Economic truth as a
          <br />
          typed, attested event bus
        </h1>
        <p>
          Casid turns Flare Data Connector proofs and FTSO feeds into durable{" "}
          <strong>topics</strong> developers subscribe to — like Kafka and Stripe
          webhooks, but every event is cryptographically verified multi-chain
          economic reality.
        </p>
        <div className="btn-row">
          <button className="btn btn-primary" disabled={busy} onClick={runDemo}>
            {busy ? "Running…" : "Run end-to-end demo"}
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={firePayment}>
            Simulate XRP payment
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={fireFtso}>
            Simulate FTSO cross
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={liveFdc}>
            Live FDC prepare
          </button>
          <button className="btn btn-ghost" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert error">{error}</div>}
        {lastProof && (
          <div className="alert">
            <strong>Proof hash / commitment</strong>
            <div className="mono" style={{ marginTop: 6 }}>
              {lastProof}
            </div>
          </div>
        )}
        {composition && <div className="alert">{composition}</div>}
      </section>

      <div className="grid cols-3">
        <div className="card">
          <div className="stat">{topics.length}</div>
          <div className="stat-label">Registered topics</div>
        </div>
        <div className="card">
          <div className="stat">{events.length}</div>
          <div className="stat-label">Verified events</div>
        </div>
        <div className="card">
          <div className="stat">{deliveries.filter((d) => d.status === "delivered").length}</div>
          <div className="stat-label">Webhook deliveries</div>
        </div>
      </div>

      <h2 className="section-title">Live topics</h2>
      <div className="card">
        <div className="list">
          {topics.length === 0 && (
            <p className="muted">No topics yet — start the coordinator.</p>
          )}
          {topics.map((t) => (
            <div key={t.id} className="list-item">
              <header>
                <span className="pill">{t.kind}</span>
                <span className="muted">#{t.onChainId ?? "—"}</span>
              </header>
              <div className="mono">{t.uri}</div>
            </div>
          ))}
        </div>
      </div>

      <h2 className="section-title">Recent verified events</h2>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Topic</th>
              <th>Proof</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {events.slice(0, 8).map((e) => (
              <tr key={e.id}>
                <td className="muted">{new Date(e.createdAt).toLocaleTimeString()}</td>
                <td>
                  <span className="pill">{e.attestationType}</span>
                </td>
                <td className="mono">{e.topicUri.replace("topic://", "")}</td>
                <td className="mono">{e.proofHash.slice(0, 18)}…</td>
                <td>
                  <span className={`pill ${e.verified ? "success" : "warn"}`}>
                    {e.verified ? (e.mock ? "mock-verified" : "verified") : "pending"}
                  </span>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Run the demo to emit the first attested event.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
