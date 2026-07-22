/**
 * Live FDC integration against Flare testnet verifiers + DA Layer.
 * @see https://dev.flare.network/fdc/guides/fdc-by-hand
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { FlareContext } from "./flare";

const API_KEY =
  process.env.FDC_API_KEY ?? "00000000-0000-0000-0000-000000000000";

const VERIFIER_BASE =
  process.env.FDC_VERIFIER_URL ??
  "https://fdc-verifiers-testnet.flare.network";

const DA_BASE =
  process.env.DA_LAYER_URL ?? "https://ctn2-data-availability.flare.network";

/** UTF-8 string zero-padded to bytes32 */
export function toBytes32String(s: string): Hex {
  const hex = Buffer.from(s, "utf8").toString("hex");
  return `0x${hex.padEnd(64, "0")}` as Hex;
}

export const ATTESTATION_TYPES = {
  AddressValidity: toBytes32String("AddressValidity"),
  Payment: toBytes32String("Payment"),
  EVMTransaction: toBytes32String("EVMTransaction"),
  Web2Json: toBytes32String("Web2Json"),
} as const;

export const SOURCE_IDS = {
  testXRP: toBytes32String("testXRP"),
  testBTC: toBytes32String("testBTC"),
  testDOGE: toBytes32String("testDOGE"),
  XRP: toBytes32String("XRP"),
  BTC: toBytes32String("BTC"),
  DOGE: toBytes32String("DOGE"),
} as const;

const fdcHubAbi = [
  {
    type: "function",
    name: "requestAttestation",
    stateMutability: "payable",
    inputs: [{ name: "_data", type: "bytes" }],
    outputs: [],
  },
] as const;

const feeConfigAbi = [
  {
    type: "function",
    name: "getRequestFee",
    stateMutability: "view",
    inputs: [{ name: "_data", type: "bytes" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export type PrepareResult = {
  status: string;
  abiEncodedRequest: Hex;
  raw: unknown;
};

export async function prepareAddressValidity(
  addressStr: string,
  source: "testXRP" | "XRP" = "testXRP",
): Promise<PrepareResult> {
  const url = `${VERIFIER_BASE}/verifier/xrp/AddressValidity/prepareRequest`;
  const body = {
    attestationType: ATTESTATION_TYPES.AddressValidity,
    sourceId: SOURCE_IDS[source],
    requestBody: { addressStr },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`Verifier prepare failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    status: string;
    abiEncodedRequest: string;
  };
  return {
    status: json.status,
    abiEncodedRequest: json.abiEncodedRequest as Hex,
    raw: json,
  };
}

export async function preparePayment(opts: {
  chain: "xrp" | "btc" | "doge";
  transactionId: string;
  inUtxo?: number;
  source?: string;
}): Promise<PrepareResult> {
  const chain = opts.chain;
  const sourceId =
    opts.source ??
    (chain === "xrp" ? "testXRP" : chain === "btc" ? "testBTC" : "testDOGE");
  const url = `${VERIFIER_BASE}/verifier/${chain}/Payment/prepareRequest`;
  const body = {
    attestationType: ATTESTATION_TYPES.Payment,
    sourceId: toBytes32String(sourceId),
    requestBody: {
      transactionId: opts.transactionId,
      inUtxo: String(opts.inUtxo ?? 0),
      utxo: String(opts.inUtxo ?? 0),
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(
      `Payment prepare failed: ${res.status} ${await res.text()}`,
    );
  }
  const json = (await res.json()) as {
    status: string;
    abiEncodedRequest: string;
  };
  return {
    status: json.status,
    abiEncodedRequest: json.abiEncodedRequest as Hex,
    raw: json,
  };
}

/** Coston2 FdcRequestFeeConfigurations */
const FEE_CONFIG_COSTON2 =
  "0x191a1282Ac700edE65c5B0AaF313BAcC3eA7fC7e" as Address;

export async function getRequestFee(
  client: PublicClient,
  abiEncodedRequest: Hex,
  feeConfig: Address = FEE_CONFIG_COSTON2,
): Promise<bigint> {
  return client.readContract({
    address: feeConfig,
    abi: feeConfigAbi,
    functionName: "getRequestFee",
    args: [abiEncodedRequest],
  });
}

export function votingRoundId(txTimestampSec: number): number {
  const firstVotingRoundStartTs = 1_658_430_000;
  const votingEpochDurationSeconds = 90;
  return Math.floor(
    (txTimestampSec - firstVotingRoundStartTs) / votingEpochDurationSeconds,
  );
}

export async function submitAttestationRequest(
  ctx: FlareContext,
  abiEncodedRequest: Hex,
): Promise<{ txHash: Hex; votingRound: number; fee: string; blockNumber: bigint }> {
  const fdcHub = ctx.addresses.FdcHub;
  if (!fdcHub) throw new Error("FdcHub not resolved");

  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY required for live FDC submit");

  const account = privateKeyToAccount(
    (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex,
  );
  const publicClient = createPublicClient({ transport: http(ctx.rpc) });
  const wallet = createWalletClient({
    account,
    transport: http(ctx.rpc),
  });

  const fee = await getRequestFee(publicClient, abiEncodedRequest);
  const txHash = await wallet.writeContract({
    address: fdcHub,
    abi: fdcHubAbi,
    functionName: "requestAttestation",
    args: [abiEncodedRequest],
    value: fee,
    account,
    chain: null,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
  const round = votingRoundId(Number(block.timestamp));

  return {
    txHash,
    votingRound: round,
    fee: fee.toString(),
    blockNumber: receipt.blockNumber,
  };
}

export type DaProofResponse = {
  response?: Record<string, unknown>;
  proof?: string[];
  error?: string;
};

export async function fetchProofByRound(
  votingRoundId: number,
  requestBytes: Hex,
): Promise<DaProofResponse> {
  const url = `${DA_BASE.replace(/\/$/, "")}/api/v1/fdc/proof-by-request-round`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({
      votingRoundId,
      requestBytes,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    return { error: `DA ${res.status}: ${await res.text()}` };
  }
  return (await res.json()) as DaProofResponse;
}

/**
 * Full live path for AddressValidity (best demo without needing a real payment tx):
 * prepare → (optional) submit to FdcHub → wait → DA proof
 */
export async function liveAddressValidityFlow(
  ctx: FlareContext,
  addressStr: string,
  opts?: { submit?: boolean; waitRounds?: number },
): Promise<{
  prepare: PrepareResult;
  submit?: Awaited<ReturnType<typeof submitAttestationRequest>>;
  proof?: DaProofResponse;
  steps: string[];
}> {
  const steps: string[] = [];
  const prepare = await prepareAddressValidity(addressStr);
  steps.push(`prepareRequest status=${prepare.status}`);

  if (prepare.status !== "VALID") {
    return { prepare, steps: [...steps, "prepare not VALID — abort"] };
  }

  if (!opts?.submit) {
    steps.push("submit skipped (pass submit:true + DEPLOYER_PRIVATE_KEY)");
    return { prepare, steps };
  }

  const submit = await submitAttestationRequest(ctx, prepare.abiEncodedRequest);
  steps.push(
    `requestAttestation tx=${submit.txHash} round=${submit.votingRound} fee=${submit.fee}`,
  );

  // Poll DA for up to ~3 minutes (2 rounds)
  const maxAttempts = opts?.waitRounds ?? 8;
  let proof: DaProofResponse | undefined;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 20_000));
    proof = await fetchProofByRound(submit.votingRound, prepare.abiEncodedRequest);
    if (proof.response && proof.proof?.length) {
      steps.push(`DA proof ready after attempt ${i + 1}`);
      break;
    }
    steps.push(
      `DA poll ${i + 1}/${maxAttempts}: ${proof.error ?? "not ready"}`,
    );
  }

  return { prepare, submit, proof, steps };
}
