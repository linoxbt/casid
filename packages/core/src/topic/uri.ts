import type {
  ChainId,
  CompareOp,
  CompositionOp,
  ParsedTopic,
  TopicSpec,
} from "../types/index";

/**
 * Casid topic URI scheme:
 *   topic://payment/{chain}/{destination}
 *   topic://ftso/price/{feed}/threshold/{op}/{value}
 *   topic://web2json/{sourceId}/{jqHash}
 *   topic://composition/{and|or}/... (built programmatically)
 *   topic://fasset/{mint|redeem}/{asset}
 */

const CHAIN_ALIASES: Record<string, ChainId> = {
  xrp: "XRPL",
  xrpl: "XRPL",
  btc: "BTC",
  bitcoin: "BTC",
  doge: "DOGE",
  flr: "FLR",
  flare: "FLR",
  eth: "ETH",
  sgb: "SGB",
};

const OPS: CompareOp[] = ["gt", "gte", "lt", "lte", "eq"];

export function normalizeChain(raw: string): ChainId {
  const key = raw.toLowerCase();
  const c = CHAIN_ALIASES[key] ?? (raw.toUpperCase() as ChainId);
  return c;
}

export function buildPaymentUri(chain: ChainId | string, destination: string): string {
  const c = typeof chain === "string" ? normalizeChain(chain) : chain;
  const slug = c === "XRPL" ? "xrp" : c.toLowerCase();
  return `topic://payment/${slug}/${destination}`;
}

export function buildFtsoThresholdUri(
  feed: string,
  op: CompareOp,
  threshold: number,
): string {
  const feedSlug = feed.replace("/", "-");
  return `topic://ftso/price/${feedSlug}/threshold/${op}/${threshold}`;
}

export function buildCompositionUri(op: CompositionOp, childUris: string[]): string {
  const children = childUris.map((u) => u.replace(/^topic:\/\//, "")).join("+");
  return `topic://composition/${op}/${children}`;
}

export function parseTopicUri(uri: string): ParsedTopic {
  if (!uri.startsWith("topic://")) {
    throw new Error(`Invalid topic URI (must start with topic://): ${uri}`);
  }
  const path = uri.slice("topic://".length);
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) throw new Error("Empty topic URI");

  const head = parts[0]!.toLowerCase();

  if (head === "payment") {
    if (parts.length < 3) throw new Error("payment topic needs chain and destination");
    const chain = normalizeChain(parts[1]!);
    const destination = parts.slice(2).join("/");
    const spec: TopicSpec = { kind: "PAYMENT", chain, destination };
    return {
      uri,
      kind: "PAYMENT",
      spec,
      schemaHashInput: JSON.stringify({ kind: "PAYMENT", chain, destination }),
    };
  }

  if (head === "ftso") {
    // topic://ftso/price/XRP-USD/threshold/gte/0.50
    if (parts[1] !== "price" || parts[3] !== "threshold" || parts.length < 6) {
      throw new Error("ftso topic format: topic://ftso/price/{feed}/threshold/{op}/{value}");
    }
    const feed = parts[2]!.replace("-", "/");
    const op = parts[4]!.toLowerCase() as CompareOp;
    if (!OPS.includes(op)) throw new Error(`Invalid compare op: ${op}`);
    const threshold = Number(parts[5]);
    if (Number.isNaN(threshold)) throw new Error("Invalid threshold");
    const spec: TopicSpec = { kind: "FTSO_THRESHOLD", feed, op, threshold };
    return {
      uri,
      kind: "FTSO_THRESHOLD",
      spec,
      schemaHashInput: JSON.stringify({ kind: "FTSO_THRESHOLD", feed, op, threshold }),
    };
  }

  if (head === "web2json") {
    if (parts.length < 3) throw new Error("web2json needs sourceId and jq hash/path");
    const sourceId = parts[1]!;
    const jqTransform = parts.slice(2).join("/");
    const spec: TopicSpec = { kind: "WEB2_JSON", sourceId, jqTransform };
    return {
      uri,
      kind: "WEB2_JSON",
      spec,
      schemaHashInput: JSON.stringify({ kind: "WEB2_JSON", sourceId, jqTransform }),
    };
  }

  if (head === "composition") {
    const op = (parts[1] ?? "and").toLowerCase() as CompositionOp;
    if (op !== "and" && op !== "or") throw new Error("composition op must be and|or");
    const spec: TopicSpec = { kind: "COMPOSITION", op, children: [] };
    return {
      uri,
      kind: "COMPOSITION",
      spec,
      schemaHashInput: JSON.stringify({ kind: "COMPOSITION", op, uri }),
    };
  }

  if (head === "fasset") {
    if (parts.length < 3) throw new Error("fasset topic needs action and asset");
    const action = parts[1]!.toLowerCase() as "mint" | "redeem";
    const asset = parts[2]!.toUpperCase() as "FXRP" | "FBTC" | "FDOGE";
    const spec: TopicSpec = { kind: "FASSET_LIFECYCLE", asset, action };
    return {
      uri,
      kind: "FASSET_LIFECYCLE",
      spec,
      schemaHashInput: JSON.stringify({ kind: "FASSET_LIFECYCLE", asset, action }),
    };
  }

  throw new Error(`Unknown topic kind: ${head}`);
}

export function topicFromSpec(spec: TopicSpec): ParsedTopic {
  switch (spec.kind) {
    case "PAYMENT": {
      const uri = buildPaymentUri(spec.chain, spec.destination);
      return parseTopicUri(uri);
    }
    case "FTSO_THRESHOLD": {
      const uri = buildFtsoThresholdUri(spec.feed, spec.op, spec.threshold);
      return parseTopicUri(uri);
    }
    case "COMPOSITION": {
      const childUris = spec.children.map((c) => topicFromSpec(c).uri);
      const uri = buildCompositionUri(spec.op, childUris);
      return {
        uri,
        kind: "COMPOSITION",
        spec,
        schemaHashInput: JSON.stringify({
          kind: "COMPOSITION",
          op: spec.op,
          children: childUris,
        }),
      };
    }
    case "WEB2_JSON": {
      const uri = `topic://web2json/${spec.sourceId}/${encodeURIComponent(spec.jqTransform)}`;
      return parseTopicUri(uri);
    }
    case "EVM_TRANSACTION": {
      const uri = `topic://evm/${spec.chain.toLowerCase()}/${spec.to ?? "*"}`;
      return {
        uri,
        kind: "EVM_TRANSACTION",
        spec,
        schemaHashInput: JSON.stringify(spec),
      };
    }
    case "FASSET_LIFECYCLE": {
      const uri = `topic://fasset/${spec.action}/${spec.asset}`;
      return parseTopicUri(uri);
    }
  }
}
