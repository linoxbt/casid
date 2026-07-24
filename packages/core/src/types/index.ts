/** Casid shared types — verified economic event fabric */

export type ChainId = "XRPL" | "BTC" | "DOGE" | "FLR" | "ETH" | "SGB";

export type TopicKind =
  | "PAYMENT"
  | "FTSO_THRESHOLD"
  | "WEB2_JSON"
  | "EVM_TRANSACTION"
  | "COMPOSITION"
  | "FASSET_LIFECYCLE";

export type CompareOp = "gt" | "gte" | "lt" | "lte" | "eq";
export type CompositionOp = "and" | "or";

export interface PaymentTopicSpec {
  kind: "PAYMENT";
  chain: ChainId;
  /** Destination address on the underlying chain */
  destination: string;
  /** Optional minimum amount in smallest units (string for bigints) */
  minAmount?: string;
}

export interface FtsoThresholdTopicSpec {
  kind: "FTSO_THRESHOLD";
  /** e.g. XRP/USD */
  feed: string;
  op: CompareOp;
  /** Human decimal threshold, e.g. 0.5 for $0.50 */
  threshold: number;
}

export interface Web2JsonTopicSpec {
  kind: "WEB2_JSON";
  sourceId: string;
  jqTransform: string;
  expectedHash?: string;
}

export interface EvmTxTopicSpec {
  kind: "EVM_TRANSACTION";
  chain: "FLR" | "ETH" | "SGB";
  to?: string;
  selector?: string;
}

export interface CompositionTopicSpec {
  kind: "COMPOSITION";
  op: CompositionOp;
  children: TopicSpec[];
}

export interface FAssetLifecycleTopicSpec {
  kind: "FASSET_LIFECYCLE";
  asset: "FXRP" | "FBTC" | "FDOGE";
  action: "mint" | "redeem";
}

export type TopicSpec =
  | PaymentTopicSpec
  | FtsoThresholdTopicSpec
  | Web2JsonTopicSpec
  | EvmTxTopicSpec
  | CompositionTopicSpec
  | FAssetLifecycleTopicSpec;

export interface ParsedTopic {
  uri: string;
  kind: TopicKind;
  spec: TopicSpec;
  schemaHashInput: string;
}

export type DeliveryStatus =
  | "pending"
  | "attesting"
  | "verified"
  | "delivered"
  | "failed"
  | "dead_letter";

export interface Subscription {
  id: string;
  topicUri: string;
  topicId?: number;
  webhookUrl?: string;
  targetAddress?: string;
  active: boolean;
  createdAt: string;
  credit?: string;
}

export interface AttestedEvent {
  id: string;
  topicUri: string;
  topicId?: number;
  proofHash: string;
  eventCommitment: string;
  attestationType: TopicKind;
  payload: Record<string, unknown>;
  verified: boolean;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  eventId: string;
  status: DeliveryStatus;
  attempts: number;
  lastError?: string;
  deliveredAt?: string;
  signature?: string;
}

export interface FireTriggerRequest {
  topicUri: string;
  topicId: number;
  subId?: number;
  attestationType: TopicKind;
  proof: `0x${string}` | string;
  proofHash: `0x${string}`;
  eventCommitment: `0x${string}`;
  payload?: Record<string, unknown>;
}

export const KIND_HASH = {
  PAYMENT: "PAYMENT",
  FTSO_THRESHOLD: "FTSO_THRESHOLD",
  WEB2_JSON: "WEB2_JSON",
  EVM_TRANSACTION: "EVM_TRANSACTION",
  COMPOSITION: "COMPOSITION",
  FASSET_LIFECYCLE: "FASSET_LIFECYCLE",
} as const;
