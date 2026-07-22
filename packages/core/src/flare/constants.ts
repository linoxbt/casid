/** Flare network constants used by Casid */

export const NETWORKS = {
  coston2: {
    name: "Flare Testnet Coston2",
    chainId: 114,
    rpc: "https://coston2-api.flare.network/ext/C/rpc",
    explorer: "https://coston2-explorer.flare.network",
    daLayer: "https://ctn2-data-availability.flare.network/",
  },
  flare: {
    name: "Flare Mainnet",
    chainId: 14,
    rpc: "https://flare-api.flare.network/ext/C/rpc",
    explorer: "https://flare-explorer.flare.network",
    daLayer: "https://flr-data-availability.flare.network/",
  },
} as const;

export type CasidNetwork = keyof typeof NETWORKS;

/** keccak256 of kind strings — must match TopicLib.sol */
export const TOPIC_KIND = {
  PAYMENT: "PAYMENT",
  FTSO_THRESHOLD: "FTSO_THRESHOLD",
  WEB2_JSON: "WEB2_JSON",
  EVM_TRANSACTION: "EVM_TRANSACTION",
  COMPOSITION: "COMPOSITION",
  FASSET_LIFECYCLE: "FASSET_LIFECYCLE",
} as const;

export const ABI_FRAGMENTS = {
  topicRegistry: [
    "function createTopic(bytes32 kind, bytes32 schemaHash, string uri) returns (uint256)",
    "function createComposition(uint8 op, uint256[] childTopicIds, string uri) returns (uint256)",
    "function getTopic(uint256 topicId) view returns (tuple(bytes32 kind, bytes32 schemaHash, string uri, uint64 createdAt, address creator, bool active))",
    "function isActive(uint256 topicId) view returns (bool)",
    "function nextTopicId() view returns (uint256)",
    "event TopicCreated(uint256 indexed topicId, bytes32 indexed kind, bytes32 schemaHash, string uri, address indexed creator)",
  ],
  subscriptionHub: [
    "function subscribe(uint256 topicId, address target, bytes32 webhookCommit) payable returns (uint256)",
    "function unsubscribe(uint256 subId)",
    "function getSubscription(uint256 subId) view returns (tuple(uint256 topicId, address subscriber, address target, bytes32 webhookCommit, uint64 createdAt, bool active, uint256 credit))",
    "event Subscribed(uint256 indexed subId, uint256 indexed topicId, address indexed subscriber, address target, bytes32 webhookCommit)",
  ],
  triggerExecutor: [
    "function fireWithProof(uint256 topicId, uint256 subId, bytes32 attestationType, bytes proof, bytes32 proofHash, bytes32 eventCommitment, bytes targetCalldata)",
    "function fireFtsoThreshold(uint256 topicId, uint256 subId, bytes21 feedId, uint8 op, uint256 thresholdWei, bytes32 eventCommitment, bytes targetCalldata)",
    "event TriggerFired(uint256 indexed topicId, uint256 indexed subId, bytes32 indexed proofHash, address target, bytes32 eventCommitment)",
  ],
} as const;
