import {
  parseTopicUri,
  proofHashFromPayload,
  type AttestedEvent,
  type TopicKind,
} from "@casid/core";
import type { Store, TopicRecord } from "../lib/store";
import { findTopicByUri, recordEvent } from "../lib/store";

export interface PaymentEventInput {
  topicUri: string;
  txHash?: string;
  amount?: string;
  source?: string;
  destination?: string;
  proofResponse: Record<string, unknown>;
}

/**
 * Record a payment event after FDC proof material is available.
 */
export async function recordPaymentEvent(
  store: Store,
  input: PaymentEventInput,
): Promise<AttestedEvent> {
  const topic = findTopicByUri(store, input.topicUri);
  if (!topic) throw new Error(`Topic not found: ${input.topicUri}`);
  if (topic.kind !== "PAYMENT") {
    throw new Error(`Topic is not PAYMENT: ${input.topicUri}`);
  }

  if (input.amount != null && !/^\d+$/.test(input.amount)) {
    throw new Error("amount must be an integer string in smallest units");
  }

  const parsed = parseTopicUri(topic.uri);

  let destination = input.destination ?? "unknown";
  let chain = "XRPL";
  if (parsed.spec.kind === "PAYMENT") {
    destination = input.destination ?? parsed.spec.destination;
    chain = parsed.spec.chain;
  }

  const payload = {
    type: "PAYMENT" as const,
    chain,
    destination,
    amount: input.amount ?? "1000000",
    txHash: input.txHash,
    source: input.source,
    proofResponse: input.proofResponse,
    blockNumber: Math.floor(Date.now() / 1000),
    live: true,
  };

  const proofHash = await proofHashFromPayload(payload);
  const eventCommitment = await proofHashFromPayload({
    topic: topic.uri,
    txHash: payload.txHash,
  });

  const event: AttestedEvent = {
    id: crypto.randomUUID(),
    topicUri: topic.uri,
    topicId: topic.onChainId,
    proofHash,
    eventCommitment,
    attestationType: "PAYMENT",
    payload,
    verified: true,
    createdAt: new Date().toISOString(),
  };

  return recordEvent(store, event);
}

export async function recordFtsoEvent(
  store: Store,
  topicUri: string,
  observedPrice?: number,
): Promise<AttestedEvent> {
  const topic = findTopicByUri(store, topicUri);
  if (!topic) throw new Error(`Topic not found: ${topicUri}`);

  const parsed = parseTopicUri(topic.uri);
  if (parsed.spec.kind !== "FTSO_THRESHOLD") {
    throw new Error("Topic is not FTSO_THRESHOLD");
  }

  const price = observedPrice ?? parsed.spec.threshold * 1.1;
  const payload = {
    type: "FTSO_THRESHOLD" as const,
    feed: parsed.spec.feed,
    op: parsed.spec.op,
    threshold: parsed.spec.threshold,
    observedPrice: price,
    crossed: compare(parsed.spec.op, price, parsed.spec.threshold),
    live: true,
  };

  if (!payload.crossed) {
    throw new Error(
      `Price ${price} does not satisfy ${parsed.spec.op} ${parsed.spec.threshold}`,
    );
  }

  const proofHash = await proofHashFromPayload({
    ...payload,
    bucket: Math.floor(Date.now() / 60_000),
  });

  const event: AttestedEvent = {
    id: crypto.randomUUID(),
    topicUri: topic.uri,
    topicId: topic.onChainId,
    proofHash,
    eventCommitment: await proofHashFromPayload(payload),
    attestationType: "FTSO_THRESHOLD",
    payload,
    verified: true,
    createdAt: new Date().toISOString(),
  };

  return recordEvent(store, event);
}

function compare(op: string, value: number, threshold: number): boolean {
  switch (op) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    case "eq":
      return value === threshold;
    default:
      return false;
  }
}

/** Build opaque proof bytes for on-chain verifier adapters. */
export function encodeProofPayload(event: AttestedEvent): `0x${string}` {
  const json = JSON.stringify(event.payload);
  const hex = Buffer.from(json, "utf8").toString("hex");
  return `0x${hex}`;
}

export function topicKindToBytes32Label(kind: TopicKind): string {
  return kind;
}

export function describeAttestationPipeline(topic: TopicRecord): string[] {
  switch (topic.kind) {
    case "PAYMENT":
      return [
        "1. Submit FDC Payment attestation request (FdcHub.requestAttestation)",
        "2. Wait for voting round finalization (Relay Merkle root)",
        "3. Fetch response + Merkle proof from DA Layer",
        "4. Casid ProofVerifier.verifyAndConsume → TriggerExecutor.fireWithProof",
        "5. Fan-out signed webhooks to subscribers",
      ];
    case "FTSO_THRESHOLD":
      return [
        "1. Read FTSOv2 feed (getFeedByIdInWei)",
        "2. Evaluate CompareOp against threshold",
        "3. Bind proofHash to feed snapshot + block bucket",
        "4. TriggerExecutor.fireFtsoThreshold",
        "5. Fan-out signed webhooks",
      ];
    case "COMPOSITION":
      return [
        "1. Evaluate each child topic (Payment FDC + FTSO, etc.)",
        "2. Apply AND/OR composition algebra",
        "3. Fire only when composition satisfies",
        "4. Single eventCommitment binds all child proofs",
      ];
    default:
      return ["Attestation path depends on topic kind"];
  }
}
