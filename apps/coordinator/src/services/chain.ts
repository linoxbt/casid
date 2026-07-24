/**
 * Optional on-chain trigger submission when DEPLOYER_PRIVATE_KEY is set
 * and TriggerExecutor is deployed.
 */

import {
  createWalletClient,
  http,
  type Address,
  type Hex,
  keccak256,
  parseEther,
  stringToHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { FlareContext } from "./flare";
import type { AttestedEvent } from "@casid/core";

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
        method: "fireWithProof",
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
  const attestationType = kindToBytes32(event.attestationType);
  const proof =
    opts?.proofHex ??
    (`0x${Buffer.from(JSON.stringify(event.payload)).toString("hex")}` as Hex);
  const proofHash = toBytes32(event.proofHash);
  const eventCommitment = toBytes32(event.eventCommitment);

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
