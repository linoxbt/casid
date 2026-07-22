import { Hono } from "hono";
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
  seedDemoTopics,
  type Store,
} from "./lib/store";
import {
  describeAttestationPipeline,
  encodeMockProof,
  simulateFtsoCrossing,
  simulatePaymentAttestation,
} from "./services/attestation";
import { deliverToSubscribers } from "./services/delivery";
import { fireEventOnChain } from "./services/chain";
import { evaluateComposition } from "./services/composition";
import {
  describeFdcIntegration,
  fetchDaProof,
  fdcMode,
  requestPaymentAttestation,
} from "./services/fdc";
import {
  fetchProofByRound,
  liveAddressValidityFlow,
  prepareAddressValidity,
  preparePayment,
  votingRoundId,
} from "./services/fdcLive";
import { readFtsoPriceWei, resolveFlareContext, type FlareContext } from "./services/flare";

const PORT = Number(process.env.COORDINATOR_PORT ?? 4100);
const SIGNING_SECRET =
  process.env.WEBHOOK_SIGNING_SECRET ?? "dev-change-me-casid-hmac";

const store: Store = createStore(
  process.env.DATABASE_PATH ?? "./data/casid.db",
);
seedDemoTopics(store);

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

// Warm Flare registry in background
void getFlare().catch((e) => console.warn("[flare] warm failed", e));

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "casid-coordinator",
    version: "0.2.0",
    fdcMode: fdcMode(),
    topics: store.topics.size,
    subscriptions: store.subscriptions.size,
    events: store.events.size,
    deliveries: store.deliveries.size,
    persistence: "sqlite",
  }),
);

app.get("/v1/meta", async (c) => {
  const flare = await getFlare();
  return c.json({
    name: "Casid",
    tagline: "Verified Economic Event Fabric for Flare",
    version: "0.2.0",
    fdc: describeFdcIntegration(),
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
  const body = await c.req.json<{ uri?: string; spec?: TopicSpec }>();
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
    return c.json({ topic: existing, existed: true });
  }

  const record = createTopicRecord(store, {
    uri: uri!,
    kind: parsed.kind,
    parsed,
  });
  return c.json({ topic: record, existed: false }, 201);
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
    return c.json({ subscription: sub }, 201);
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

app.get("/v1/events", (c) => {
  return c.json({ events: listEvents(store) });
});

app.get("/v1/deliveries", (c) => {
  return c.json({ deliveries: listDeliveries(store) });
});

// --- Attestations ---

app.post("/v1/attest/payment", async (c) => {
  const body = await c.req.json<{
    topicUri: string;
    txHash?: string;
    amount?: string;
    source?: string;
    destination?: string;
    deliver?: boolean;
    fireOnChain?: boolean;
  }>();
  if (!body.topicUri) return c.json({ error: "topicUri required" }, 400);

  try {
    const flare = await getFlare();
    const fdcReceipt = await requestPaymentAttestation(flare, {
      chain: body.topicUri.includes("/btc/")
        ? "BTC"
        : body.topicUri.includes("/doge/")
          ? "DOGE"
          : "XRPL",
      txId: body.txHash ?? `demo-tx-${Date.now()}`,
    });

    const event = await simulatePaymentAttestation(store, body);
    const da = await fetchDaProof(flare, { mockPayload: event.payload });

    let deliveries = [];
    if (body.deliver !== false) {
      deliveries = await deliverToSubscribers(store, event, SIGNING_SECRET);
    }

    let onChain = null;
    if (body.fireOnChain) {
      onChain = await fireEventOnChain(flare, event, {
        proofHex: (da.proof as `0x${string}`) ?? encodeMockProof(event),
      });
    } else {
      onChain = await fireEventOnChain(flare, event);
    }

    return c.json({
      event,
      fdc: fdcReceipt,
      da,
      mockProof: encodeMockProof(event),
      deliveries,
      onChain,
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

app.post("/v1/attest/ftso", async (c) => {
  const body = await c.req.json<{
    topicUri: string;
    observedPrice?: number;
    deliver?: boolean;
    useLiveFeed?: boolean;
  }>();
  if (!body.topicUri) return c.json({ error: "topicUri required" }, 400);

  try {
    let observed = body.observedPrice;

    if (body.useLiveFeed) {
      const flare = await getFlare();
      const parsed = parseTopicUri(body.topicUri);
      if (parsed.spec.kind === "FTSO_THRESHOLD") {
        const live = await readFtsoPriceWei(flare, parsed.spec.feed);
        if (live) {
          // wei units where 1e18 ≈ $1
          observed = Number(live.value) / 1e18;
        }
      }
    }

    const event = await simulateFtsoCrossing(store, body.topicUri, observed);
    let deliveries = [];
    if (body.deliver !== false) {
      deliveries = await deliverToSubscribers(store, event, SIGNING_SECRET);
    }
    return c.json({ event, deliveries, observedPrice: observed });
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
    if (result.prepare.status === "VALID") {
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
        hasProof: Boolean(result.proof?.proof?.length),
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
        mock: false,
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

app.post("/v1/demo/run", async (c) => {
  const all = listTopics(store);
  const paymentTopic =
    all.find((t) => t.kind === "PAYMENT" && t.uri.includes("/xrp/")) ??
    all.find((t) => t.kind === "PAYMENT");
  if (!paymentTopic) return c.json({ error: "No payment topic" }, 500);

  createSubscription(store, {
    topicUri: paymentTopic.uri,
    webhookUrl: "casid://log",
  });

  const flare = await getFlare();
  const fdc = await requestPaymentAttestation(flare, {
    chain: "XRPL",
    txId: `demo-${Date.now()}`,
  });

  const event = await simulatePaymentAttestation(store, {
    topicUri: paymentTopic.uri,
    amount: "25000000",
    txHash: `demo-${Date.now()}`,
  });
  const deliveries = await deliverToSubscribers(store, event, SIGNING_SECRET);
  // Prefer live on-chain fire when TRIGGER_EXECUTOR + key are configured
  const onChain = await fireEventOnChain(flare, event);

  // Also try composition evaluation if present
  const composition = all.find((t) => t.kind === "COMPOSITION");
  let compositionResult = null;
  if (composition) {
    try {
      compositionResult = evaluateComposition(store, composition.uri);
    } catch {
      /* ignore */
    }
  }

  return c.json({
    message: "Casid demo: verified XRP payment event → signed webhook delivery",
    topic: paymentTopic,
    event,
    fdc,
    mockProof: encodeMockProof(event),
    deliveries,
    onChain,
    composition: compositionResult,
    meta: {
      fdcMode: fdcMode(),
      network: flare.network,
      protocol: flare.addresses,
    },
  });
});

console.log(`Casid coordinator v0.2 listening on :${PORT}`);
export default {
  port: PORT,
  fetch: app.fetch,
};
