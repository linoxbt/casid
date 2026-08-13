import { Hono, type Context, type Next } from "hono";
import { cors } from "hono/cors";
import { parseTopicUri, topicFromSpec, type TopicSpec } from "@casid/core";
import {
  createStore,
  createSubscription,
  createTopicRecord,
  deactivateSubscription,
  findTopicByUri,
  getTopicById,
  listDeliveries,
  listEvents,
  listSubscriptions,
  listTopics,
  seedStarterTopics,
  setTopicCreatedBy,
  type Store,
} from "./lib/store";
import {
  attestPayment,
  describeAttestationPipeline,
  encodeProofPayload,
  recordFtsoEvent,
} from "./services/attestation";
import { deliverToSubscribers } from "./services/delivery";
import {
  fireEventOnChain,
  registerSubscriptionOnChain,
  registerTopicOnChain,
  topicOnChainParams,
} from "./services/chain";
import { evaluateComposition } from "./services/composition";
import {
  fetchProofByRound,
  liveAddressValidityFlow,
  prepareAddressValidity,
  preparePayment,
  votingRoundId,
} from "./services/fdcLive";
import {
  isFlareNetwork,
  readFtsoPriceWei,
  readProofVerifierMockMode,
  resolveFlareContext,
  type FlareContext,
} from "./services/flare";
import { startXrplWatcher } from "./services/xrplWatcher";
import {
  checkRateLimit,
  hasValidApiKey,
  originAllowed,
  requireConfiguredSecrets,
} from "./services/security";

const PORT = Number(process.env.COORDINATOR_PORT ?? 4100);
const SIGNING_SECRET =
  process.env.WEBHOOK_SIGNING_SECRET ?? "dev-change-me-casid-hmac";

requireConfiguredSecrets();

const store: Store = createStore(
  process.env.DATABASE_PATH ?? "./data/casid.db",
);
seedStarterTopics(store);

let flareCtx: FlareContext | null = null;

async function getFlare(): Promise<FlareContext> {
  if (!flareCtx) {
    flareCtx = await resolveFlareContext();
    console.log(
      `[flare] network=${flareCtx.network} FtsoV2=${flareCtx.addresses.FtsoV2 ?? "—"} FdcHub=${flareCtx.addresses.FdcHub ?? "—"}`,
    );
  }
  return flareCtx;
}

// Only watch XRPL when actually pointed at a real Flare network — mirrors
// the same FLARE_CHAIN_ID=31337 signal index.test.ts uses to keep itself
// hermetic, so `bun test` never opens a live interval or hits XRPL's RPC.
if (isFlareNetwork(Number(process.env.FLARE_CHAIN_ID ?? 114)) && process.env.XRPL_WATCHER_ENABLED !== "false") {
  startXrplWatcher(store, getFlare, SIGNING_SECRET);
}

// Warm Flare registry in background
void getFlare().catch((e) => console.warn("[flare] warm failed", e));

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => originAllowed(origin) ?? "",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use("/v1/*", async (c, next) => {
  if (["GET", "OPTIONS"].includes(c.req.method)) return next();
  if (!hasValidApiKey(c.req.header("Authorization"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});

// Rate-limit the routes that trigger real outbound testnet calls and/or
// on-chain writes, so a leaked or over-scoped API key can't spam them. Keyed
// by the authenticated API key only — client-supplied headers like
// x-forwarded-for are trivially spoofable and would let each request claim a
// fresh bucket, defeating the limit entirely. Unauthenticated callers (dev
// mode with no CASID_API_KEY configured) share a single bucket instead.
const rateLimited = async (c: Context, next: Next) => {
  const authHeader = c.req.header("Authorization");
  const key = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "anonymous";
  const result = checkRateLimit(key);
  if (!result.allowed) {
    return c.json(
      { error: "Rate limit exceeded", retryAfterMs: result.retryAfterMs },
      429,
    );
  }
  return next();
};
app.use("/v1/attest/*", rateLimited);
app.use("/v1/fdc/*", rateLimited);

app.get("/health", async (c) => {
  const flare = await getFlare();
  const onChainVerification = await readProofVerifierMockMode(flare);
  return c.json({
    ok: true,
    service: "casid-coordinator",
    version: "0.2.0",
    fdcMode: "live",
    onChainVerification,
    topics: store.topics.size,
    subscriptions: store.subscriptions.size,
    events: store.events.size,
    deliveries: store.deliveries.size,
    persistence: "sqlite",
  });
});

app.get("/v1/meta", async (c) => {
  const flare = await getFlare();
  const onChainVerification = await readProofVerifierMockMode(flare);
  return c.json({
    name: "Casid",
    tagline: "Verified Economic Event Fabric for Flare",
    version: "0.2.0",
    fdc: {
      mode: "live",
      onChainVerification,
      steps: [
        "Prepare FDC request with verifier server",
        "Submit abiEncodedRequest to FdcHub with request fee",
        "Wait for voting round finalization",
        "Fetch Merkle proof from DA Layer",
        "Record verified event and deliver signed webhooks",
      ],
      docs: "https://dev.flare.network/fdc/overview",
    },
    network: {
      name: flare.network,
      chainId: flare.chainId,
      rpc: flare.rpc,
      daLayer: flare.daLayer,
      registry: flare.registry,
    },
    protocol: flare.addresses,
    contracts: {
      topicRegistry: flare.casid.topicRegistry ?? null,
      proofVerifier: flare.casid.proofVerifier ?? null,
      subscriptionHub: flare.casid.subscriptionHub ?? null,
      triggerExecutor: flare.casid.triggerExecutor ?? null,
    },
    primitives: ["FDC", "FTSO", "FAssets", "FCC (roadmap)"],
  });
});

// --- Topics ---

app.get("/v1/topics", (c) => {
  return c.json({
    topics: listTopics(store).map((t) => ({
      id: t.id,
      onChainId: t.onChainId,
      uri: t.uri,
      kind: t.kind,
      active: t.active,
      createdAt: t.createdAt,
      pipeline: describeAttestationPipeline(t),
    })),
  });
});

app.post("/v1/topics", async (c) => {
  const body = await c.req.json<{ uri?: string; spec?: TopicSpec; createdBy?: string }>();
  let uri = body.uri;
  let parsed;
  try {
    if (body.spec) {
      parsed = topicFromSpec(body.spec);
      uri = parsed.uri;
    } else if (uri) {
      parsed = parseTopicUri(uri);
    } else {
      return c.json({ error: "Provide uri or spec" }, 400);
    }
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }

  const existing = findTopicByUri(store, uri!);
  if (existing) {
    return c.json({
      topic: existing,
      existed: true,
      onChainParams: topicOnChainParams(existing.kind, existing.parsed.schemaHashInput),
    });
  }

  const record = createTopicRecord(store, {
    uri: uri!,
    kind: parsed.kind,
    parsed,
    createdBy: body.createdBy,
  });
  const flare = await getFlare();
  const onChain = await registerTopicOnChain(flare, {
    kind: record.kind,
    schemaHashInput: record.parsed.schemaHashInput,
    uri: record.uri,
  });
  const onChainParams = topicOnChainParams(record.kind, record.parsed.schemaHashInput);
  return c.json({ topic: record, existed: false, onChain, onChainParams }, 201);
});

app.patch("/v1/topics/:id/creator", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ address?: string }>();
  if (!body.address) return c.json({ error: "address required" }, 400);
  const existing = getTopicById(store, id);
  if (!existing) return c.json({ error: "Topic not found" }, 404);
  const updated = setTopicCreatedBy(store, existing.uri, body.address);
  return c.json({ topic: updated });
});

app.get("/v1/topics/:id", (c) => {
  const id = c.req.param("id");
  const t =
    getTopicById(store, id) ??
    findTopicByUri(store, decodeURIComponent(id));
  if (!t) return c.json({ error: "Not found" }, 404);
  return c.json({ topic: t, pipeline: describeAttestationPipeline(t) });
});

// --- Subscriptions ---

app.get("/v1/subscriptions", (c) => {
  return c.json({ subscriptions: listSubscriptions(store) });
});

app.post("/v1/subscriptions", async (c) => {
  const body = await c.req.json<{
    topicUri: string;
    webhookUrl?: string;
    targetAddress?: string;
  }>();
  if (!body.topicUri) return c.json({ error: "topicUri required" }, 400);
  try {
    const sub = createSubscription(store, body);
    const flare = await getFlare();
    const onChain = await registerSubscriptionOnChain(flare, {
      topicId: sub.topicId,
      webhookUrl: sub.webhookUrl,
      targetAddress: sub.targetAddress,
    });
    return c.json({ subscription: sub, onChain }, 201);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

app.delete("/v1/subscriptions/:id", (c) => {
  const sub = deactivateSubscription(store, c.req.param("id"));
  if (!sub) return c.json({ error: "Not found" }, 404);
  return c.json({ subscription: sub });
});

// --- Events & deliveries ---

function clampLimit(raw: string | undefined, fallback = 100, max = 200): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

app.get("/v1/events", (c) => {
  const limit = clampLimit(c.req.query("limit"));
  const before = c.req.query("before");
  return c.json({ events: listEvents(store, limit, before) });
});

app.get("/v1/deliveries", (c) => {
  const limit = clampLimit(c.req.query("limit"));
  return c.json({
    deliveries: listDeliveries(store, limit).map((d) => ({
      ...d,
      signature: d.signature ? `${d.signature.slice(0, 24)}...` : undefined,
    })),
  });
});

// --- Attestations ---

app.post("/v1/attest/payment", async (c) => {
  const body = await c.req.json<{
    topicUri: string;
    txHash?: string;
    amount?: string;
    deliver?: boolean;
    fireOnChain?: boolean;
    waitRounds?: number;
  }>();
  if (!body.topicUri) return c.json({ error: "topicUri required" }, 400);

  try {
    const flare = await getFlare();
    const chain = body.topicUri.includes("/btc/")
      ? "btc"
      : body.topicUri.includes("/doge/")
        ? "doge"
        : "xrp";

    if (!body.txHash) {
      return c.json({ error: "txHash required for FDC Payment attestation" }, 400);
    }

    const result = await attestPayment(store, flare, SIGNING_SECRET, {
      topicUri: body.topicUri,
      chain,
      txHash: body.txHash,
      amount: body.amount,
      deliver: body.deliver,
      fireOnChain: body.fireOnChain,
      waitRounds: body.waitRounds,
    });

    if (result.status === "pending_proof") {
      return c.json(result, 202);
    }

    return c.json({
      event: result.event,
      fdc: result.fdc,
      deliveries: result.deliveries,
      onChain: result.onChain,
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

app.post("/v1/attest/ftso", async (c) => {
  const body = await c.req.json<{
    topicUri: string;
    deliver?: boolean;
    fireOnChain?: boolean;
  }>();
  if (!body.topicUri) return c.json({ error: "topicUri required" }, 400);

  try {
    const flare = await getFlare();
    const parsed = parseTopicUri(body.topicUri);
    if (parsed.spec.kind !== "FTSO_THRESHOLD") {
      return c.json({ error: "Topic is not FTSO_THRESHOLD" }, 400);
    }
    const live = await readFtsoPriceWei(flare, parsed.spec.feed);
    if (!live) {
      return c.json({ error: "Live FTSO feed unavailable" }, 503);
    }
    const observed = Number(live.value) / 1e18;

    const event = await recordFtsoEvent(store, body.topicUri, observed);
    let deliveries = [];
    if (body.deliver !== false) {
      deliveries = await deliverToSubscribers(store, event, SIGNING_SECRET);
    }
    const onChain = body.fireOnChain ? await fireEventOnChain(flare, event, { proofHex: encodeProofPayload(event) }) : null;
    return c.json({ event, deliveries, observedPrice: observed, ftso: live, onChain });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

app.post("/v1/composition/evaluate", async (c) => {
  const body = await c.req.json<{ topicUri: string; windowMs?: number }>();
  if (!body.topicUri) return c.json({ error: "topicUri required" }, 400);
  try {
    const result = evaluateComposition(store, body.topicUri, body.windowMs);
    return c.json(result);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

/** Live FDC: prepare AddressValidity via Flare verifier (no gas) */
app.post("/v1/fdc/prepare/address-validity", async (c) => {
  const body = await c.req.json<{ address: string }>();
  if (!body.address) return c.json({ error: "address required" }, 400);
  try {
    const prepare = await prepareAddressValidity(body.address);
    return c.json({
      prepare,
      next: [
        "FdcHub.requestAttestation(abiEncodedRequest) with fee",
        "Wait ~90s voting round",
        "POST /v1/fdc/proof with votingRoundId + requestBytes",
      ],
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

/** Live FDC: prepare Payment (needs real underlying tx id) */
app.post("/v1/fdc/prepare/payment", async (c) => {
  const body = await c.req.json<{
    chain: "xrp" | "btc" | "doge";
    transactionId: string;
    inUtxo?: number;
  }>();
  if (!body.chain || !body.transactionId) {
    return c.json({ error: "chain and transactionId required" }, 400);
  }
  try {
    const prepare = await preparePayment(body);
    return c.json({ prepare });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

/** Live FDC: fetch DA proof after round finalization */
app.post("/v1/fdc/proof", async (c) => {
  const body = await c.req.json<{
    votingRoundId: number;
    requestBytes: `0x${string}`;
  }>();
  if (body.votingRoundId == null || !body.requestBytes) {
    return c.json({ error: "votingRoundId and requestBytes required" }, 400);
  }
  const proof = await fetchProofByRound(body.votingRoundId, body.requestBytes);
  return c.json({ proof, votingRoundId: body.votingRoundId });
});

/**
 * Live FDC end-to-end for AddressValidity.
 * prepare always; submit only if DEPLOYER_PRIVATE_KEY set and submit:true
 */
app.post("/v1/fdc/live/address-validity", async (c) => {
  const body = await c.req.json<{
    address?: string;
    submit?: boolean;
    waitRounds?: number;
  }>();
  const address = body.address ?? "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe";
  try {
    const flare = await getFlare();
    const result = await liveAddressValidityFlow(flare, address, {
      submit: body.submit === true,
      waitRounds: body.waitRounds,
    });

    let casidEvent = null;
    if (result.prepare.status === "VALID" && result.proof?.proof?.length) {
      const { recordEvent, createTopicRecord, findTopicByUri } = await import(
        "./lib/store"
      );
      const { proofHashFromPayload } = await import("@casid/core");
      const topicUri = `topic://web2json/fdc-address-validity/${address}`;
      if (!findTopicByUri(store, topicUri)) {
        createTopicRecord(store, {
          uri: topicUri,
          kind: "WEB2_JSON",
          parsed: {
            uri: topicUri,
            kind: "WEB2_JSON",
            spec: {
              kind: "WEB2_JSON",
              sourceId: "fdc-address-validity",
              jqTransform: ".isValid",
            },
            schemaHashInput: topicUri,
          },
        });
      }
      const topic = findTopicByUri(store, topicUri);
      const payload = {
        type: "FDC_ADDRESS_VALIDITY",
        address,
        status: result.prepare.status,
        abiEncodedRequest: result.prepare.abiEncodedRequest,
        submitTx: result.submit?.txHash ?? null,
        votingRound: result.submit?.votingRound ?? null,
        hasProof: true,
        live: true,
      };
      casidEvent = {
        id: crypto.randomUUID(),
        topicUri,
        topicId: topic?.onChainId,
        proofHash: await proofHashFromPayload(payload),
        eventCommitment: await proofHashFromPayload({
          address,
          status: result.prepare.status,
        }),
        attestationType: "WEB2_JSON" as const,
        payload,
        verified: true,
        createdAt: new Date().toISOString(),
      };
      recordEvent(store, casidEvent);
      await deliverToSubscribers(store, casidEvent, SIGNING_SECRET);
    }

    return c.json({
      message: "Live FDC AddressValidity flow (Flare verifier + optional FdcHub)",
      ...result,
      casidEvent,
      network: { chainId: flare.chainId, fdcHub: flare.addresses.FdcHub },
      votingRoundNow: votingRoundId(Math.floor(Date.now() / 1000)),
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.get("/v1/ftso/:feed", async (c) => {
  const feed = decodeURIComponent(c.req.param("feed")).replace("-", "/");
  const flare = await getFlare();
  const live = await readFtsoPriceWei(flare, feed);
  if (!live) {
    return c.json(
      {
        feed,
        error: "FTSO feed unavailable (check feed id encoding or registry)",
        ftsoV2: flare.addresses.FtsoV2 ?? null,
      },
      404,
    );
  }
  return c.json({
    feed,
    feedId: live.feedId,
    valueWei: live.value.toString(),
    valueUsdApprox: Number(live.value) / 1e18,
    timestamp: live.timestamp.toString(),
    ftsoV2: flare.addresses.FtsoV2,
  });
});

console.log(`Casid coordinator v0.2 listening on :${PORT}`);
export default {
  port: PORT,
  fetch: app.fetch,
};
