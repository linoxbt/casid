"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Subscription, type Topic } from "@/lib/api";
import { useWallet, getWalletClient } from "@/components/wallet-context";
import { COSTON2_CHAIN_ID, TOPIC_REGISTRY_ADDRESS, topicRegistryAbi } from "@/lib/wallet";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [uri, setUri] = useState("topic://payment/xrp/rYourDestinationHere");
  const [webhook, setWebhook] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [pendingOnChain, setPendingOnChain] = useState<{
    id: string;
    uri: string;
    kind: `0x${string}`;
    schemaHash: `0x${string}`;
  } | null>(null);

  const { address, chainId, connect, ensureCoston2 } = useWallet();

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
    setPendingOnChain(null);
    try {
      const trimmedUri = uri.trim();
      const res = await api.createTopic(trimmedUri, address ?? undefined);
      setMsg(`Topic ready: ${res.topic.uri}`);
      if (res.onChainParams) {
        setPendingOnChain({ id: res.topic.id, uri: res.topic.uri, ...res.onChainParams });
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function signOnChain() {
    if (!pendingOnChain) return;
    setErr(null);
    if (!address) {
      await connect();
      return;
    }
    setSigning(true);
    try {
      if (chainId !== COSTON2_CHAIN_ID) await ensureCoston2();
      if (!TOPIC_REGISTRY_ADDRESS) throw new Error("NEXT_PUBLIC_TOPIC_REGISTRY_ADDRESS not configured.");
      const wallet = getWalletClient(address);
      const txHash = await wallet.writeContract({
        address: TOPIC_REGISTRY_ADDRESS,
        abi: topicRegistryAbi,
        functionName: "createTopic",
        args: [pendingOnChain.kind, pendingOnChain.schemaHash, pendingOnChain.uri],
        chain: null,
      });
      await api.setTopicCreator(pendingOnChain.id, address);
      setMsg(`Signed on-chain: ${txHash.slice(0, 10)}… (as ${shortAddr(address)})`);
      setPendingOnChain(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSigning(false);
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
        <p>The contract between your app and Casid — a payment address or a price threshold.</p>
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
              <code className="mono">topic://payment/xrp/{"{addr}"}</code> or{" "}
              <code className="mono">topic://ftso/price/XRP-USD/threshold/gte/0.50</code>
            </p>
            <button className="btn btn-primary" onClick={createTopic}>
              Create topic
            </button>
            {pendingOnChain && (
              <div className="alert">
                Register on-chain with your own wallet instead of Casid&apos;s relay:
                <div style={{ marginTop: "0.5rem" }}>
                  <button className="btn btn-ghost" onClick={signOnChain} disabled={signing}>
                    {signing ? "Signing…" : address ? `Sign as ${shortAddr(address)}` : "Connect wallet to sign"}
                  </button>
                </div>
              </div>
            )}
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
                {t.createdBy && ` · by ${shortAddr(t.createdBy)}`}
              </span>
            </header>
            <div className="mono">{t.uri}</div>
          </div>
        ))}
      </div>
    </>
  );
}
