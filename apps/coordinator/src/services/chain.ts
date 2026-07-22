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

export type FireResult =
  | { ok: true; txHash: Hex; mode: "live" }
  | { ok: true; mode: "dry_run"; call: Record<string, unknown> }
  | { ok: false; error: string };

function kindToBytes32(kind: string): Hex {
  // Solidity uses keccak256("PAYMENT") etc. via TopicLib constants
  return keccak256(stringToHex(kind));
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

  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) {
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
    const account = privateKeyToAccount(
      (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex,
    );
    const wallet = createWalletClient({
      account,
      transport: http(ctx.rpc),
    });

    const txHash = await wallet.writeContract({
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
      account,
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
