/**
 * Optional on-chain trigger submission when DEPLOYER_PRIVATE_KEY is set
 * and TriggerExecutor is deployed.
 */

import {
  createWalletClient,
  encodeAbiParameters,
  http,
  type Address,
  type Hex,
  keccak256,
  parseEther,
  parseUnits,
  stringToHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { FlareContext } from "./flare";
import { feedIdFromSymbol } from "./flare";
import type { AttestedEvent } from "@casid/core";

// Mirrors IPayment.Proof from contracts/src/interfaces/IPayment.sol exactly —
// field names/order/types must match Flare's real struct, not a Casid shape.
const paymentProofAbiParam = {
  type: "tuple",
  components: [
    { name: "merkleProof", type: "bytes32[]" },
    {
      name: "data",
      type: "tuple",
      components: [
        { name: "attestationType", type: "bytes32" },
        { name: "sourceId", type: "bytes32" },
        { name: "votingRound", type: "uint64" },
        { name: "lowestUsedTimestamp", type: "uint64" },
        {
          name: "requestBody",
          type: "tuple",
          components: [
            { name: "transactionId", type: "bytes32" },
            { name: "inUtxo", type: "uint256" },
            { name: "utxo", type: "uint256" },
          ],
        },
        {
          name: "responseBody",
          type: "tuple",
          components: [
            { name: "blockNumber", type: "uint64" },
            { name: "blockTimestamp", type: "uint64" },
            { name: "sourceAddressHash", type: "bytes32" },
            { name: "sourceAddressesRoot", type: "bytes32" },
            { name: "receivingAddressHash", type: "bytes32" },
            { name: "intendedReceivingAddressHash", type: "bytes32" },
            { name: "spentAmount", type: "int256" },
            { name: "intendedSpentAmount", type: "int256" },
            { name: "receivedAmount", type: "int256" },
            { name: "intendedReceivedAmount", type: "int256" },
            { name: "standardPaymentReference", type: "bytes32" },
            { name: "oneToOne", type: "bool" },
            { name: "status", type: "uint8" },
          ],
        },
      ],
    },
  ],
} as const;

function toBigInt(v: unknown, field: string): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.trunc(v));
  if (typeof v === "string" && v.length > 0) return BigInt(v);
  throw new Error(`Payment proof field "${field}" is not a valid integer: ${JSON.stringify(v)}`);
}

function toHex32(v: unknown, field: string): Hex {
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`Payment proof field "${field}" is not a hex string: ${JSON.stringify(v)}`);
  }
  const hex = v.startsWith("0x") ? v.slice(2) : v;
  return `0x${hex.padStart(64, "0")}` as Hex;
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return Boolean(v);
}

/**
 * ABI-encodes the DA Layer's { response, proof } into the exact
 * IPayment.Proof struct ProofVerifier.sol now abi.decode's on-chain. The DA
 * Layer's `response` field names follow Flare's own struct field names
 * (their documented convention across FDC tooling); values may arrive as
 * strings (common for uint64/uint256/int256 in JSON APIs to avoid precision
 * loss), so every numeric/hex field is converted defensively rather than
 * assumed to already be the right JS type.
 */
export function encodePaymentProof(daProof: {
  response: Record<string, unknown>;
  proof: string[];
}): Hex {
  const r = daProof.response;
  const requestBody = (r.requestBody ?? {}) as Record<string, unknown>;
  const responseBody = (r.responseBody ?? {}) as Record<string, unknown>;

  return encodeAbiParameters(
    [paymentProofAbiParam],
    [
      {
        merkleProof: daProof.proof.map((p) => toHex32(p, "merkleProof[]")),
        data: {
          attestationType: toHex32(r.attestationType, "attestationType"),
          sourceId: toHex32(r.sourceId, "sourceId"),
          votingRound: toBigInt(r.votingRound, "votingRound"),
          lowestUsedTimestamp: toBigInt(r.lowestUsedTimestamp, "lowestUsedTimestamp"),
          requestBody: {
            transactionId: toHex32(requestBody.transactionId, "requestBody.transactionId"),
            inUtxo: toBigInt(requestBody.inUtxo ?? "0", "requestBody.inUtxo"),
            utxo: toBigInt(requestBody.utxo ?? "0", "requestBody.utxo"),
          },
          responseBody: {
            blockNumber: toBigInt(responseBody.blockNumber, "responseBody.blockNumber"),
            blockTimestamp: toBigInt(responseBody.blockTimestamp, "responseBody.blockTimestamp"),
            sourceAddressHash: toHex32(responseBody.sourceAddressHash, "responseBody.sourceAddressHash"),
            sourceAddressesRoot: toHex32(responseBody.sourceAddressesRoot, "responseBody.sourceAddressesRoot"),
            receivingAddressHash: toHex32(responseBody.receivingAddressHash, "responseBody.receivingAddressHash"),
            intendedReceivingAddressHash: toHex32(
              responseBody.intendedReceivingAddressHash,
              "responseBody.intendedReceivingAddressHash",
            ),
            spentAmount: toBigInt(responseBody.spentAmount, "responseBody.spentAmount"),
            intendedSpentAmount: toBigInt(responseBody.intendedSpentAmount, "responseBody.intendedSpentAmount"),
            receivedAmount: toBigInt(responseBody.receivedAmount, "responseBody.receivedAmount"),
            intendedReceivedAmount: toBigInt(
              responseBody.intendedReceivedAmount,
              "responseBody.intendedReceivedAmount",
            ),
            standardPaymentReference: toHex32(
              responseBody.standardPaymentReference,
              "responseBody.standardPaymentReference",
            ),
            oneToOne: toBool(responseBody.oneToOne),
            status: Number(responseBody.status ?? 0),
          },
        },
      },
    ],
  );
}

const triggerExecutorAbi = [
  {
    type: "function",
    name: "fireWithProof",
    stateMutability: "nonpayable",
    inputs: [
      { name: "topicId", type: "uint256" },
      { name: "subId", type: "uint256" },
      { name: "attestationType", type: "bytes32" },
      { name: "proof", type: "bytes" },
      { name: "proofHash", type: "bytes32" },
      { name: "eventCommitment", type: "bytes32" },
      { name: "targetCalldata", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "fireFtsoThreshold",
    stateMutability: "nonpayable",
    inputs: [
      { name: "topicId", type: "uint256" },
      { name: "subId", type: "uint256" },
      { name: "feedId", type: "bytes21" },
      { name: "op", type: "uint8" },
      { name: "thresholdWei", type: "uint256" },
      { name: "eventCommitment", type: "bytes32" },
      { name: "targetCalldata", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const topicRegistryAbi = [
  {
    type: "function",
    name: "createTopic",
    stateMutability: "nonpayable",
    inputs: [
      { name: "kind", type: "bytes32" },
      { name: "schemaHash", type: "bytes32" },
      { name: "uri", type: "string" },
    ],
    outputs: [{ name: "topicId", type: "uint256" }],
  },
] as const;

const subscriptionHubAbi = [
  {
    type: "function",
    name: "subscribe",
    stateMutability: "payable",
    inputs: [
      { name: "topicId", type: "uint256" },
      { name: "target", type: "address" },
      { name: "webhookCommit", type: "bytes32" },
    ],
    outputs: [{ name: "subId", type: "uint256" }],
  },
] as const;

export type FireResult =
  | { ok: true; txHash: Hex; mode: "live" }
  | { ok: true; mode: "dry_run"; call: Record<string, unknown> }
  | { ok: false; error: string };

export type ChainWriteResult =
  | { ok: true; mode: "live"; txHash: Hex }
  | { ok: true; mode: "dry_run"; reason: string; call: Record<string, unknown> }
  | { ok: false; error: string };

function kindToBytes32(kind: string): Hex {
  // Solidity uses keccak256("PAYMENT") etc. via TopicLib constants
  return keccak256(stringToHex(kind));
}

/**
 * The exact (kind, schemaHash) bytes32 pair TopicRegistry.createTopic
 * expects, computed the same way registerTopicOnChain does below — exposed
 * so a client with its own wallet can sign the same call itself instead of
 * relying on the coordinator's relay key.
 */
export function topicOnChainParams(kind: string, schemaHashInput: string): { kind: Hex; schemaHash: Hex } {
  return { kind: kindToBytes32(kind), schemaHash: keccak256(stringToHex(schemaHashInput)) };
}

function requireAccount(ctx: FlareContext): { account: ReturnType<typeof privateKeyToAccount>; wallet: ReturnType<typeof createWalletClient> } | null {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) return null;
  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as Hex);
  const wallet = createWalletClient({ account, transport: http(ctx.rpc) });
  return { account, wallet };
}

export async function registerTopicOnChain(
  ctx: FlareContext,
  input: { kind: string; schemaHashInput: string; uri: string },
): Promise<ChainWriteResult> {
  const registry = ctx.casid.topicRegistry;
  const kind = kindToBytes32(input.kind);
  const schemaHash = keccak256(stringToHex(input.schemaHashInput));
  if (!registry) {
    return { ok: true, mode: "dry_run", reason: "TOPIC_REGISTRY_ADDRESS not set", call: { method: "createTopic", kind, schemaHash, uri: input.uri } };
  }
  const signer = requireAccount(ctx);
  if (!signer) {
    return { ok: true, mode: "dry_run", reason: "DEPLOYER_PRIVATE_KEY not set", call: { contract: registry, method: "createTopic", kind, schemaHash, uri: input.uri } };
  }
  try {
    const txHash = await signer.wallet.writeContract({
      address: registry,
      abi: topicRegistryAbi,
      functionName: "createTopic",
      args: [kind, schemaHash, input.uri],
      account: signer.account,
      chain: null,
    });
    return { ok: true, mode: "live", txHash };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function registerSubscriptionOnChain(
  ctx: FlareContext,
  input: { topicId?: number; webhookUrl?: string; targetAddress?: string },
): Promise<ChainWriteResult> {
  const hub = ctx.casid.subscriptionHub;
  const target = (input.targetAddress ?? "0x0000000000000000000000000000000000000000") as Address;
  const webhookCommit = input.webhookUrl ? keccak256(stringToHex(input.webhookUrl)) : ("0x" + "0".repeat(64)) as Hex;
  const topicId = BigInt(input.topicId ?? 0);
  if (!hub || topicId === 0n) {
    return { ok: true, mode: "dry_run", reason: hub ? "topicId unavailable" : "SUBSCRIPTION_HUB_ADDRESS not set", call: { method: "subscribe", topicId: topicId.toString(), target, webhookCommit } };
  }
  const signer = requireAccount(ctx);
  if (!signer) {
    return { ok: true, mode: "dry_run", reason: "DEPLOYER_PRIVATE_KEY not set", call: { contract: hub, method: "subscribe", topicId: topicId.toString(), target, webhookCommit } };
  }
  try {
    const value = process.env.SUBSCRIPTION_CREDIT_ETH ? parseEther(process.env.SUBSCRIPTION_CREDIT_ETH) : 0n;
    const txHash = await signer.wallet.writeContract({
      address: hub,
      abi: subscriptionHubAbi,
      functionName: "subscribe",
      args: [topicId, target, webhookCommit],
      value,
      account: signer.account,
      chain: null,
    });
    return { ok: true, mode: "live", txHash };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function toBytes32(hexOrHash: string): Hex {
  if (hexOrHash.startsWith("0x") && hexOrHash.length === 66) {
    return hexOrHash as Hex;
  }
  return keccak256(stringToHex(hexOrHash));
}

// Mirrors contracts/src/libraries/TopicLib.sol's CompareOp enum order exactly.
const COMPARE_OP_INDEX: Record<string, number> = { gt: 0, gte: 1, lt: 2, lte: 3, eq: 4 };

/**
 * FTSO_THRESHOLD events have no FDC proof to verify — the threshold check
 * itself IS the on-chain verification (TriggerExecutor reads FtsoV2 live and
 * reverts if the threshold isn't currently met). Routing them through
 * fireWithProof's FDC-attestation-gated ProofVerifier.verifyAndConsume was
 * always going to revert with UnsupportedAttestationType; fireFtsoThreshold
 * is the real on-chain entrypoint built for this, calling
 * ProofVerifier.consumeFtsoProof (no attestation-type check) instead.
 */
async function fireFtsoThresholdOnChain(
  ctx: FlareContext,
  event: AttestedEvent,
  topicId: bigint,
  subId: bigint,
  eventCommitment: Hex,
): Promise<FireResult> {
  const executor = ctx.casid.triggerExecutor as Address;
  const feed = String(event.payload.feed ?? "");
  const op = String(event.payload.op ?? "gte").toLowerCase();
  const threshold = String(event.payload.threshold ?? "0");
  const feedId = feedIdFromSymbol(feed);
  const opIndex = COMPARE_OP_INDEX[op] ?? 1;
  const thresholdWei = parseUnits(threshold, 18);

  const signer = requireAccount(ctx);
  if (!signer) {
    return {
      ok: true,
      mode: "dry_run",
      call: {
        contract: executor,
        method: "fireFtsoThreshold",
        args: {
          topicId: topicId.toString(),
          subId: subId.toString(),
          feedId,
          op: opIndex,
          thresholdWei: thresholdWei.toString(),
          eventCommitment,
        },
      },
    };
  }

  try {
    const txHash = await signer.wallet.writeContract({
      address: executor,
      abi: triggerExecutorAbi,
      functionName: "fireFtsoThreshold",
      args: [topicId, subId, feedId, opIndex, thresholdWei, eventCommitment, "0x"],
      chain: null,
      account: signer.account,
    });
    return { ok: true, mode: "live", txHash };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function fireEventOnChain(
  ctx: FlareContext,
  event: AttestedEvent,
  opts?: { subId?: number; proofHex?: Hex },
): Promise<FireResult> {
  const executor = ctx.casid.triggerExecutor;
  if (!executor) {
    return {
      ok: true,
      mode: "dry_run",
      call: {
        contract: null,
        method: event.attestationType === "FTSO_THRESHOLD" ? "fireFtsoThreshold" : "fireWithProof",
        reason: "TRIGGER_EXECUTOR_ADDRESS not set",
        topicId: event.topicId,
        proofHash: event.proofHash,
        eventCommitment: event.eventCommitment,
        attestationType: event.attestationType,
      },
    };
  }

  const topicId = BigInt(event.topicId ?? 0);
  const subId = BigInt(opts?.subId ?? 0);
  const eventCommitment = toBytes32(event.eventCommitment);

  if (event.attestationType === "FTSO_THRESHOLD") {
    return fireFtsoThresholdOnChain(ctx, event, topicId, subId, eventCommitment);
  }

  const attestationType = kindToBytes32(event.attestationType);
  const proof =
    opts?.proofHex ??
    (`0x${Buffer.from(JSON.stringify(event.payload)).toString("hex")}` as Hex);
  const proofHash = toBytes32(event.proofHash);

  const signer = requireAccount(ctx);
  if (!signer) {
    return {
      ok: true,
      mode: "dry_run",
      call: {
        contract: executor,
        method: "fireWithProof",
        args: {
          topicId: topicId.toString(),
          subId: subId.toString(),
          attestationType,
          proof,
          proofHash,
          eventCommitment,
        },
      },
    };
  }

  try {
    const txHash = await signer.wallet.writeContract({
      address: executor as Address,
      abi: triggerExecutorAbi,
      functionName: "fireWithProof",
      args: [
        topicId,
        subId,
        attestationType,
        proof,
        proofHash,
        eventCommitment,
        "0x",
      ],
      chain: null,
      account: signer.account,
    });

    return { ok: true, mode: "live", txHash };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export { triggerExecutorAbi };
