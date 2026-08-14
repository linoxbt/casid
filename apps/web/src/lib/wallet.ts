import type { Address, Hex } from "viem";

export const COSTON2_CHAIN_ID = 114;

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

export type Hex32 = Hex;
