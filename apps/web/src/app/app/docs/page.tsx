"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

const nav = [
  ["overview", "Overview"],
  ["concepts", "Core concepts"],
  ["topics", "Topic URI reference"],
  ["api", "API reference"],
  ["webhooks", "Webhook delivery"],
  ["architecture", "Architecture"],
  ["contracts", "On-chain contracts"],
  ["flare", "Flare integration"],
  ["limitations", "Known limitations"],
  ["start", "Getting started"],
  ["roadmap", "Roadmap"],
] as const;

const CONTRACTS = [
  { name: "TopicRegistry", addr: "0xe132a226382E3A872d558c8c576f0aaeF864bE7C", role: "Canonical topic IDs, schema hashes, composition parent/child links." },
  { name: "ProofVerifier", addr: "0x3f800eeE8f1b4e0c6FCD90ce70BC3aB581151Ffc", role: "Decodes and verifies FDC Merkle proofs against Flare's real FdcVerification contract, and rejects replays via a used-proof set." },
  { name: "SubscriptionHub", addr: "0xAd5dD33d2F753891A18A970361C81a87c401f31d", role: "On-chain subscription records, webhook-URL commitments, and optional native-token credit deposits." },
  { name: "TriggerExecutor", addr: "0x50622392654467D6ebb544A74215B655e812C9Fd", role: "fireWithProof (Payment/other FDC-attested proofs) and fireFtsoThreshold — proof-gated event emission and optional downstream calldata execution." },
];

const TOPIC_KINDS = [
  {
    kind: "PAYMENT",
    syntax: "topic://payment/{chain}/{destination}",
    example: "topic://payment/xrp/rYourDestinationHere",
    verifies: "FDC Payment attestation",
    notes: "chain is xrp, btc, or doge. destination is the receiving address on that chain. Verified against a real transaction id you submit via /v1/attest/payment.",
  },
  {
    kind: "FTSO_THRESHOLD",
    syntax: "topic://ftso/price/{feed}/threshold/{op}/{value}",
    example: "topic://ftso/price/XRP-USD/threshold/gte/0.50",
    verifies: "FTSOv2 live price feed",
    notes: "op is one of gt, gte, lt, lte, eq. Reads FtsoV2.getFeedByIdInWei on Coston2 at verification time — no external transaction needed.",
  },
  {
    kind: "COMPOSITION",
    syntax: "topic://composition/{and|or}/{child1}+{child2}+...",
    example: "topic://composition/and/payment/xrp/rDest+ftso/price/XRP-USD/threshold/gte/0.50",
    verifies: "Boolean AND/OR over recently-verified child topics",
    notes: "Children are other topic URIs with the topic:// prefix stripped, joined by +. Evaluated via /v1/composition/evaluate over a recent time window.",
  },
  {
    kind: "FASSET_LIFECYCLE",
    syntax: "topic://fasset/{mint|redeem}/{FXRP|FBTC|FDOGE}",
    example: "topic://fasset/mint/FXRP",
    verifies: "FAsset mint/redeem lifecycle events",
    notes: "Roadmap primitive for tracking FAsset collateral lifecycle — registration works today; live attestation is not yet wired.",
  },
  {
    kind: "WEB2_JSON",
    syntax: "topic://web2json/{sourceId}/{jqTransform}",
    example: "topic://web2json/fdc-address-validity/rYourAddress",
    verifies: "FDC Web2Json attestation",
    notes: "Used internally by the live AddressValidity flow (/v1/fdc/live/address-validity) to record a verified event once a Flare verifier confirms an address.",
  },
  {
    kind: "EVM_TRANSACTION",
    syntax: "topic://evm/{flr|eth|sgb}/{to|*}",
    example: "topic://evm/flr/*",
    verifies: "EVM transaction match (roadmap)",
    notes: "Parsed today; not yet wired to a live verification path.",
  },
];

const ENDPOINTS = [
  { method: "GET", path: "/health", desc: "Service status, live/mock verification mode, and row counts for topics/subscriptions/events/deliveries." },
  { method: "GET", path: "/v1/meta", desc: "Network config, resolved Flare contract addresses (FtsoV2, FdcHub, FdcVerification, Relay), and deployed Casid contract addresses." },
  { method: "GET", path: "/v1/topics", desc: "List all registered topics." },
  { method: "POST", path: "/v1/topics", desc: "Register a topic. Body: { uri, createdBy? }. Registers on-chain via TopicRegistry.createTopic when a relay key is configured, and returns onChainParams (kind, schemaHash) for client-side signing otherwise." },
  { method: "PATCH", path: "/v1/topics/:id/creator", desc: "Record the wallet address that signed a topic's on-chain registration (used when a connected wallet signs directly instead of the coordinator's relay key). Body: { address }." },
  { method: "GET", path: "/v1/topics/:id", desc: "Fetch a single topic by id." },
  { method: "GET", path: "/v1/subscriptions", desc: "List all webhook subscriptions." },
  { method: "POST", path: "/v1/subscriptions", desc: "Subscribe to a topic. Body: { topicUri, webhookUrl?, targetAddress? }." },
  { method: "DELETE", path: "/v1/subscriptions/:id", desc: "Deactivate a subscription." },
  { method: "GET", path: "/v1/events", desc: "List verified events, most recent first. Query: ?limit=" },
  { method: "GET", path: "/v1/deliveries", desc: "List webhook delivery attempts and their status. Query: ?limit=" },
  { method: "POST", path: "/v1/attest/payment", desc: "Verify a real XRP/BTC/DOGE transaction against a PAYMENT topic via live FDC. Body: { topicUri, txHash, amount?, deliver?, fireOnChain?, waitRounds? }. Returns 202 with status: \"pending_proof\" while the DA Layer proof is still finalizing." },
  { method: "POST", path: "/v1/attest/ftso", desc: "Read a live FTSOv2 price and evaluate an FTSO_THRESHOLD topic. Body: { topicUri, deliver?, fireOnChain? }. See Known limitations — fireOnChain is not yet supported for this topic kind." },
  { method: "POST", path: "/v1/composition/evaluate", desc: "Evaluate a COMPOSITION topic's AND/OR over its children's recent events. Body: { topicUri, windowMs? }." },
  { method: "POST", path: "/v1/fdc/prepare/address-validity", desc: "Prepare (no gas) an AddressValidity attestation request against Flare's live testnet verifier. Body: { address }." },
  { method: "POST", path: "/v1/fdc/prepare/payment", desc: "Prepare (no gas) a Payment attestation request for an existing transaction. Body: { chain, transactionId, inUtxo? }." },
  { method: "POST", path: "/v1/fdc/proof", desc: "Fetch a Merkle proof from the DA Layer for a finalized voting round. Body: { votingRoundId, requestBytes }." },
  { method: "POST", path: "/v1/fdc/live/address-validity", desc: "End-to-end live AddressValidity: prepare, optionally submit to FdcHub (when submit:true and a deployer key is configured), and record a verified event. Body: { address?, submit?, waitRounds? }." },
  { method: "GET", path: "/v1/ftso/:feed", desc: "Read a live FTSOv2 price for an arbitrary feed (e.g. /v1/ftso/XRP-USD), independent of any topic." },
];

export default function DocsPage() {
  const [onChainVerification, setOnChainVerification] = useState<
    "live" | "mock" | "unknown" | "checking"
  >("checking");
  const [coordinatorUrl, setCoordinatorUrl] = useState("http://localhost:4100");

  useEffect(() => {
    setCoordinatorUrl(process.env.NEXT_PUBLIC_COORDINATOR_URL ?? "http://localhost:4100");
    let cancelled = false;
    api
      .meta()
      .then((m) => {
        if (!cancelled) setOnChainVerification(m.fdc?.onChainVerification ?? "unknown");
      })
      .catch(() => {
        if (!cancelled) setOnChainVerification("unknown");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <section className="hero">
        <h1>Docs</h1>
        <p>
          Everything Casid does: the topic model, every API endpoint, the proof and webhook
          pipeline, deployed contracts, and what is and isn&apos;t live yet — no gaps papered over.
        </p>
      </section>

      <nav className="docs-toc" aria-label="Sections">
        {nav.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="docs-toc-link">
            {label}
          </a>
        ))}
      </nav>

      <div className="card" id="overview" style={{ scrollMarginTop: "5rem" }}>
        <h2>On-chain verification status</h2>
        <p className="muted" style={{ lineHeight: 1.6, margin: "0.4rem 0 0" }}>
          {onChainVerification === "live" && (
            <>
              <span className="pill success">live</span> Real FDC Merkle proofs, verified
              on-chain against Flare&apos;s deployed FdcVerification contract.
            </>
          )}
          {onChainVerification === "mock" && (
            <>
              <span className="pill">mock</span> Accepts any non-empty proof — not yet
              cryptographic.
            </>
          )}
          {(onChainVerification === "unknown" || onChainVerification === "checking") && (
            <>
              <span className="pill">unknown</span> Coordinator offline or not configured.
            </>
          )}
        </p>
        <p className="muted" style={{ margin: "0.75rem 0 0", fontSize: "0.86rem" }}>
          Coordinator: <code className="mono">{coordinatorUrl}</code>
        </p>
      </div>

      <h2 className="section-title">What Casid is</h2>
      <p className="muted" style={{ lineHeight: 1.65, maxWidth: "62ch" }}>
        Casid is a <strong>verified economic event fabric for Flare</strong>. It turns Flare&apos;s
        enshrined FDC attestations (XRP/BTC/DOGE payments, address validity, Web2Json) and FTSOv2
        price feeds into durable, typed <strong>attested topics</strong> that developers subscribe
        to. Think Kafka topics plus Stripe-style signed webhooks, except every event is backed by
        a real cryptographic attestation or a live on-chain read — not an indexer&apos;s best
        guess. Casid is infrastructure, not a dApp: it doesn&apos;t hold user funds, and it
        doesn&apos;t make economic decisions on your behalf. It verifies a fact happened, then
        tells whoever is listening.
      </p>

      <h2 className="section-title" id="concepts" style={{ scrollMarginTop: "5rem" }}>
        Core concepts
      </h2>
      <div className="grid cols-2">
        <div className="card">
          <h3>Attested topic</h3>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            A durable, typed, composable primitive identified by a <code className="mono">topic://</code>{" "}
            URI. Registering one does not verify anything by itself — it declares{" "}
            <em>what kind of fact</em> you care about and how to check it. Six kinds exist today;
            see the reference below.
          </p>
        </div>
        <div className="card">
          <h3>Verified event</h3>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            The record produced when a topic&apos;s condition is checked and holds: a{" "}
            <code className="mono">proofHash</code>, an <code className="mono">eventCommitment</code>,
            the raw payload, and a timestamp. Stored off-chain in the coordinator&apos;s database and
            optionally fired on-chain as a real transaction.
          </p>
        </div>
        <div className="card">
          <h3>Subscription</h3>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            A webhook URL (and/or an on-chain target address) bound to a topic. Every verified
            event for that topic gets fanned out to every active subscriber, HMAC-signed, with
            automatic retries on failure.
          </p>
        </div>
        <div className="card">
          <h3>On-chain trigger</h3>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            An optional real transaction (<code className="mono">TriggerExecutor.fireWithProof</code>{" "}
            or <code className="mono">fireFtsoThreshold</code>) that records the verified event
            on Coston2 itself and can execute downstream calldata. Requested per-call via{" "}
            <code className="mono">fireOnChain: true</code>.
          </p>
        </div>
      </div>

      <h2 className="section-title" id="topics" style={{ scrollMarginTop: "5rem" }}>
        Topic URI reference
      </h2>
      <p className="muted" style={{ margin: "0 0 1rem", lineHeight: 1.6 }}>
        Every topic is a URI. The scheme determines which Flare primitive verifies it and what
        the pipeline looks like end to end.
      </p>
      <div className="docs-topic-list">
        {TOPIC_KINDS.map((t) => (
          <div className="card" key={t.kind}>
            <span className="pill">{t.kind}</span>
            <p className="mono" style={{ margin: "0.6rem 0 0", fontSize: "0.82rem" }}>
              {t.syntax}
            </p>
            <p className="mono" style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "var(--accent)" }}>
              {t.example}
            </p>
            <p className="muted" style={{ margin: "0.6rem 0 0", fontSize: "0.86rem" }}>
              <strong style={{ color: "var(--ink)" }}>Verifies:</strong> {t.verifies}
            </p>
            <p className="muted" style={{ margin: "0.4rem 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
              {t.notes}
            </p>
          </div>
        ))}
      </div>

      <h2 className="section-title" id="api" style={{ scrollMarginTop: "5rem" }}>
        API reference
      </h2>
      <p className="muted" style={{ margin: "0 0 1rem", lineHeight: 1.6 }}>
        Base URL: <code className="mono">{coordinatorUrl}</code>. Non-<code className="mono">GET</code>{" "}
        routes require <code className="mono">Authorization: Bearer &lt;CASID_API_KEY&gt;</code> when
        the coordinator is running with <code className="mono">NODE_ENV=production</code> (which the
        live deployment does).
      </p>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: "4.5rem" }}>Method</th>
              <th>Path</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {ENDPOINTS.map((e) => (
              <tr key={e.method + e.path}>
                <td>
                  <span className={`pill ${e.method === "GET" ? "success" : ""}`}>{e.method}</span>
                </td>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>{e.path}</td>
                <td className="muted" style={{ fontSize: "0.86rem", lineHeight: 1.5 }}>{e.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title" id="webhooks" style={{ scrollMarginTop: "5rem" }}>
        Webhook delivery &amp; signature verification
      </h2>
      <p className="muted" style={{ margin: "0 0 1rem", lineHeight: 1.6, maxWidth: "62ch" }}>
        Every delivery is a <code className="mono">POST</code> of the verified event JSON, signed
        Stripe-style with an <code className="mono">X-Casid-Signature</code> header:{" "}
        <code className="mono">t=&#123;unix&#125;,v1=&#123;hex&#125;</code>, where{" "}
        <code className="mono">v1</code> is HMAC-SHA256 over <code className="mono">&#123;t&#125;.&#123;raw body&#125;</code>{" "}
        using your subscription&apos;s signing secret. Failed deliveries retry with backoff up to{" "}
        <code className="mono">WEBHOOK_MAX_ATTEMPTS</code> times.
      </p>
      <div className="card">
        <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", fontWeight: 600 }}>
          Verify a delivery (Node / any Web Crypto runtime)
        </p>
        <pre className="mono" style={{ margin: 0, lineHeight: 1.6, color: "var(--muted)", overflowX: "auto" }}>
{`async function verify(secret, rawBody, header) {
  const [t, v1] = header.split(",").map((p) => p.split("=")[1]);
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(\`\${t}.\${rawBody}\`)
  );
  const hex = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === v1 && Math.abs(Date.now() / 1000 - t) < 300;
}`}
        </pre>
      </div>

      <h2 className="section-title" id="architecture" style={{ scrollMarginTop: "5rem" }}>
        System diagram
      </h2>
      <div className="card">
        <pre className="mono" style={{ margin: 0, lineHeight: 1.55, color: "var(--muted)", overflowX: "auto" }}>
{`[ XRPL / BTC / DOGE / Web2 / FTSO ]
              │
              ▼
     Flare FDC + FTSO (enshrined)
              │
              ▼
     Casid Coordinator
      · topic registry (off-chain + on-chain)
      · attestation pipeline
      · proof packaging
      · HMAC webhook fan-out
              │
        ┌─────┴─────┐
        ▼           ▼
  Signed webhooks   TriggerExecutor.sol
  (Stripe-style)    (proof-gated calls)
        │
        ▼
  Subscriber apps / agents / protocols`}
        </pre>
      </div>

      <h2 className="section-title" id="contracts" style={{ scrollMarginTop: "5rem" }}>
        On-chain contracts
      </h2>
      <p className="muted" style={{ margin: "0 0 1rem", lineHeight: 1.6 }}>
        All deployed and source-verified on Coston2 (chain id 114).
      </p>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Contract</th>
              <th>Role</th>
              <th>Address</th>
            </tr>
          </thead>
          <tbody>
            {CONTRACTS.map((c) => (
              <tr key={c.name}>
                <td className="mono">{c.name}</td>
                <td className="muted" style={{ fontSize: "0.86rem", lineHeight: 1.5 }}>{c.role}</td>
                <td>
                  <a
                    className="proof-link mono"
                    style={{ fontSize: "0.76rem" }}
                    href={`https://coston2-explorer.flare.network/address/${c.addr}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {c.addr.slice(0, 10)}…{c.addr.slice(-6)}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title" id="flare" style={{ scrollMarginTop: "5rem" }}>
        Flare integration
      </h2>
      <div className="list">
        <div className="list-item">
          <strong>FDC Payment</strong>
          <p className="muted" style={{ margin: "0.4rem 0 0", lineHeight: 1.5 }}>
            XRP/BTC/DOGE transactions, Merkle-proven via the Data Availability Layer. Casid
            prepares the attestation request, submits it to FdcHub, waits for voting-round
            finalization, and fetches the Merkle proof — the same path any independent verifier
            would use.
          </p>
        </div>
        <div className="list-item">
          <strong>FTSOv2</strong>
          <p className="muted" style={{ margin: "0.4rem 0 0", lineHeight: 1.5 }}>
            Live price thresholds read directly from the enshrined FtsoV2 contract, resolved
            dynamically via Flare&apos;s Contract Registry (no hardcoded addresses). Composable with
            payment topics via AND/OR composition.
          </p>
        </div>
        <div className="list-item">
          <strong>FAssets</strong>
          <p className="muted" style={{ margin: "0.4rem 0 0", lineHeight: 1.5 }}>
            Lifecycle topics for mint/redeem — registration works today; live attestation of
            FAsset lifecycle events is on the roadmap.
          </p>
        </div>
        <div className="list-item">
          <strong>FCC (roadmap)</strong>
          <p className="muted" style={{ margin: "0.4rem 0 0", lineHeight: 1.5 }}>
            Confidential topic filters, so a subscriber can prove a condition matched without
            revealing the underlying data to Casid itself — not yet built.
          </p>
        </div>
      </div>

      <h2 className="section-title" id="limitations" style={{ scrollMarginTop: "5rem" }}>
        Known limitations
      </h2>
      <p className="muted" style={{ margin: "0 0 1rem", lineHeight: 1.6 }}>
        Documented here deliberately, not hidden — these are real, current gaps, not
        hypothetical edge cases.
      </p>
      <div className="list">
        <div className="list-item">
          <strong>FTSO threshold events cannot fire on-chain yet.</strong>
          <p className="muted" style={{ margin: "0.4rem 0 0", lineHeight: 1.5 }}>
            <code className="mono">POST /v1/attest/ftso</code> with{" "}
            <code className="mono">fireOnChain: true</code> reverts with{" "}
            <code className="mono">ProofVerifier.UnsupportedAttestationType()</code>.{" "}
            <code className="mono">ProofVerifier</code>/<code className="mono">TriggerExecutor</code>&apos;s{" "}
            <code className="mono">fireWithProof</code> path was built for FDC-attested proofs (a
            real Merkle proof, e.g. a Payment) — an FTSO threshold read has no such proof, it&apos;s a
            direct on-chain price comparison, so routing it through the same
            attestation-type-gated verifier doesn&apos;t hold up. Off-chain verification and signed
            webhook delivery for FTSO topics are fully live and unaffected; only the optional
            on-chain trigger fire is broken. Fixing this needs a dedicated on-chain
            FTSO-threshold verification path, not a quick patch.
          </p>
        </div>
        <div className="list-item">
          <strong>No persistent database volume on the hosted coordinator.</strong>
          <p className="muted" style={{ margin: "0.4rem 0 0", lineHeight: 1.5 }}>
            SQLite lives on the Railway container&apos;s ephemeral filesystem. A redeploy wipes
            topics, subscriptions, events, and deliveries back to the two seed topics. Fine for a
            testnet demo backend; would need a mounted volume or Postgres before anything durable
            depends on this data surviving a deploy.
          </p>
        </div>
        <div className="list-item">
          <strong>FAsset and EVM-transaction topics register but don&apos;t verify live.</strong>
          <p className="muted" style={{ margin: "0.4rem 0 0", lineHeight: 1.5 }}>
            <code className="mono">FASSET_LIFECYCLE</code> and <code className="mono">EVM_TRANSACTION</code>{" "}
            topics parse and register correctly, but there is no live attestation path wired up
            for either kind yet — see Roadmap.
          </p>
        </div>
      </div>

      <h2 className="section-title" id="start" style={{ scrollMarginTop: "5rem" }}>
        Getting started
      </h2>
      <div className="grid cols-2">
        <div className="card">
          <h3>1. Register a topic</h3>
          <p className="muted" style={{ margin: "0.4rem 0 0", lineHeight: 1.5 }}>
            <Link href="/app/topics" className="proof-link">
              Open Topics
            </Link>{" "}
            and register a payment or FTSO threshold URI, or use{" "}
            <code className="mono">POST /v1/topics</code> directly.
          </p>
        </div>
        <div className="card">
          <h3>2. Subscribe a webhook</h3>
          <p className="muted" style={{ margin: "0.4rem 0 0", lineHeight: 1.5 }}>
            Point a webhook URL at the topic. Every future verified event gets delivered there,
            signed — see Webhook delivery above for how to verify it.
          </p>
        </div>
        <div className="card">
          <h3>3. Verify a proof</h3>
          <p className="muted" style={{ margin: "0.4rem 0 0", lineHeight: 1.5 }}>
            <Link href="/app/verify" className="proof-link">
              Open Verify
            </Link>{" "}
            to submit a real transaction id, check a live FTSO threshold, evaluate a composition,
            or run a live address-validity check.
          </p>
        </div>
        <div className="card">
          <h3>4. Try Unlock</h3>
          <p className="muted" style={{ margin: "0.4rem 0 0", lineHeight: 1.5 }}>
            <Link href="/app/unlock" className="proof-link">
              Open Unlock
            </Link>{" "}
            for the fastest way to feel the whole pipeline: gate a message behind a real payment,
            then pay it yourself and watch it unlock.
          </p>
        </div>
      </div>

      <h2 className="section-title" id="roadmap" style={{ scrollMarginTop: "5rem" }}>
        Operational roadmap
      </h2>
      <div className="grid cols-2">
        <div className="card">
          <h3>Current system</h3>
          <ul className="pipeline">
            <li>Topic DSL + registry (TS + Solidity)</li>
            <li>Live FDC request, submit, and DA proof polling</li>
            <li>FTSO threshold path against live Flare feeds</li>
            <li>HMAC webhooks + dashboard</li>
            <li>Foundry suite for anti-replay &amp; compositions</li>
          </ul>
        </div>
        <div className="card">
          <h3>Production path</h3>
          <ul className="pipeline">
            <li>On-chain FTSO-threshold verification path</li>
            <li>Persistent storage (mounted volume or Postgres) + queue workers</li>
            <li>Live FAsset lifecycle + EVM-transaction attestation</li>
            <li>Topic marketplace + enterprise private topics</li>
            <li>Decentralized coordinators</li>
          </ul>
        </div>
      </div>
    </>
  );
}
