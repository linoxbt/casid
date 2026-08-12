import type { Address, Hex } from "viem";

export const COSTON2_CHAIN_ID = 114;
export const COSTON2_CHAIN_ID_HEX = "0x72";

export const COSTON2_ADD_CHAIN_PARAMS = {
  chainId: COSTON2_CHAIN_ID_HEX,
  chainName: "Flare Testnet Coston2",
  nativeCurrency: { name: "Coston2 Flare", symbol: "C2FLR", decimals: 18 },
  rpcUrls: ["https://coston2-api.flare.network/ext/C/rpc"],
  blockExplorerUrls: ["https://coston2-explorer.flare.network"],
};

export const TOPIC_REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_TOPIC_REGISTRY_ADDRESS ??
  "") as Address;

export const topicRegistryAbi = [
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

/** Minimal EIP-1193 provider shape — enough of window.ethereum for our needs. */
export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export function getInjectedProvider(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  return window.ethereum;
}

export type Hex32 = Hex;
