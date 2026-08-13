import {
  createPublicClient,
  http,
  type Address,
  type PublicClient,
} from "viem";
import { NETWORKS, type CasidNetwork } from "@casid/core";

/** FlareContractRegistry — same address on all Flare networks */
export const FLARE_CONTRACT_REGISTRY =
  "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019" as const;

const registryAbi = [
  {
    type: "function",
    name: "getContractAddressByName",
    stateMutability: "view",
    inputs: [{ name: "_name", type: "string" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getAllContracts",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "_names", type: "string[]" },
      { name: "_addresses", type: "address[]" },
    ],
  },
] as const;

const ftsoV2Abi = [
  {
    type: "function",
    name: "getFeedByIdInWei",
    stateMutability: "view",
    inputs: [{ name: "_feedId", type: "bytes21" }],
    outputs: [
      { name: "value", type: "uint256" },
      { name: "timestamp", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "getFeedsByIdInWei",
    stateMutability: "view",
    inputs: [{ name: "_feedIds", type: "bytes21[]" }],
    outputs: [
      { name: "_values", type: "uint256[]" },
      { name: "_timestamps", type: "uint64[]" },
    ],
  },
] as const;

export type FlareContext = {
  network: CasidNetwork;
  chainId: number;
  rpc: string;
  client: PublicClient;
  registry: typeof FLARE_CONTRACT_REGISTRY;
  addresses: {
    FtsoV2?: Address;
    FdcHub?: Address;
    FdcVerification?: Address;
    Relay?: Address;
  };
  casid: {
    topicRegistry?: Address;
    proofVerifier?: Address;
    subscriptionHub?: Address;
    triggerExecutor?: Address;
  };
  daLayer: string;
};

function networkFromEnv(): CasidNetwork {
  const chainId = Number(process.env.FLARE_CHAIN_ID ?? 114);
  return chainId === 14 ? "flare" : "coston2";
}

export function isFlareNetwork(chainId: number): boolean {
  // Flare mainnet 14, Coston2 114, Songbird 19, Coston 16
  return [14, 114, 19, 16].includes(chainId);
}

export function createFlareClient(network?: CasidNetwork): PublicClient {
  const n = network ?? networkFromEnv();
  const rpc = process.env.FLARE_RPC_URL ?? NETWORKS[n].rpc;
  return createPublicClient({
    transport: http(rpc),
  });
}

export async function resolveFlareContext(): Promise<FlareContext> {
  const network = networkFromEnv();
  const meta = NETWORKS[network];
  const rpc = process.env.FLARE_RPC_URL ?? meta.rpc;
  const client = createPublicClient({ transport: http(rpc) });

  const names = ["FtsoV2", "FdcHub", "FdcVerification", "Relay"] as const;
  const addresses: FlareContext["addresses"] = {};
  const chainId = Number(process.env.FLARE_CHAIN_ID ?? meta.chainId);

  if (isFlareNetwork(chainId)) {
    for (const name of names) {
      try {
        const addr = await client.readContract({
          address: FLARE_CONTRACT_REGISTRY,
          abi: registryAbi,
          functionName: "getContractAddressByName",
          args: [name],
        });
        if (addr && addr !== "0x0000000000000000000000000000000000000000") {
          addresses[name] = addr;
        }
      } catch (err) {
        console.warn(
          `[flare] failed to resolve ${name}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  } else {
    console.log(
      `[flare] chainId=${chainId} is not a Flare network — skipping protocol registry`,
    );
  }

  const casid: FlareContext["casid"] = {
    topicRegistry: (process.env.TOPIC_REGISTRY_ADDRESS || undefined) as
      | Address
      | undefined,
    proofVerifier: (process.env.PROOF_VERIFIER_ADDRESS || undefined) as
      | Address
      | undefined,
    subscriptionHub: (process.env.SUBSCRIPTION_HUB_ADDRESS || undefined) as
      | Address
      | undefined,
    triggerExecutor: (process.env.TRIGGER_EXECUTOR_ADDRESS || undefined) as
      | Address
      | undefined,
  };

  return {
    network,
    chainId,
    rpc,
    client,
    registry: FLARE_CONTRACT_REGISTRY,
    addresses,
    casid,
    daLayer: process.env.DA_LAYER_URL ?? meta.daLayer,
  };
}

/**
 * Encode FTSO feed id as bytes21.
 * Crypto feeds often use hex category 01 + feed name; for local development we also accept
 * the MockFtsoV2 style of bytes21(bytes("XRP/USD")).
 */
export function feedIdFromSymbol(feed: string): `0x${string}` {
  // Prefer explicit env mapping: FTSO_FEED_XRP_USD=0x...
  const envKey = `FTSO_FEED_${feed.replace("/", "_").toUpperCase()}`;
  const fromEnv = process.env[envKey];
  if (fromEnv?.startsWith("0x")) return fromEnv as `0x${string}`;

  // bytes21 left-padded UTF-8 of feed name (matches our mock / deploy seed)
  const bytes = new TextEncoder().encode(feed);
  const hex = Buffer.from(bytes).toString("hex").padEnd(42, "0").slice(0, 42);
  return `0x${hex}`;
}

export async function readFtsoPriceWei(
  ctx: FlareContext,
  feed: string,
): Promise<{ value: bigint; timestamp: bigint; feedId: `0x${string}` } | null> {
  if (!ctx.addresses.FtsoV2) return null;
  const feedId = feedIdFromSymbol(feed);
  try {
    const [value, timestamp] = await ctx.client.readContract({
      address: ctx.addresses.FtsoV2,
      abi: ftsoV2Abi,
      functionName: "getFeedByIdInWei",
      args: [feedId],
    });
    return { value, timestamp, feedId };
  } catch (err) {
    console.warn(`[ftso] read failed for ${feed}:`, err);
    return null;
  }
}

const proofVerifierMockModeAbi = [
  {
    type: "function",
    name: "mockMode",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

type MockModeResult = "live" | "mock" | "unknown";
let mockModeCache: { value: MockModeResult; expiresAt: number } | null = null;
const MOCK_MODE_CACHE_TTL_MS = 30_000;

/**
 * Reads the deployed ProofVerifier's actual on-chain mockMode flag, so
 * status endpoints report real verification state instead of an assumed one.
 * Cached briefly — /health and /v1/meta are both polled every few seconds by
 * the dashboard and each call this, so an uncached read doubles live RPC
 * calls for a flag that only changes when an operator runs SetLive.s.sol.
 */
export async function readProofVerifierMockMode(
  ctx: FlareContext,
): Promise<MockModeResult> {
  if (!ctx.casid.proofVerifier) return "unknown";
  if (mockModeCache && Date.now() < mockModeCache.expiresAt) {
    return mockModeCache.value;
  }
  try {
    const mockMode = await ctx.client.readContract({
      address: ctx.casid.proofVerifier,
      abi: proofVerifierMockModeAbi,
      functionName: "mockMode",
    });
    const value: MockModeResult = mockMode ? "mock" : "live";
    mockModeCache = { value, expiresAt: Date.now() + MOCK_MODE_CACHE_TTL_MS };
    return value;
  } catch (err) {
    console.warn("[flare] failed to read ProofVerifier.mockMode:", err);
    return "unknown";
  }
}

export { ftsoV2Abi, registryAbi };
