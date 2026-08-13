/**
 * Passive XRPL payment watcher — polls each active `topic://payment/xrp/{dest}`
 * topic's destination address for new incoming payments and runs them through
 * the same attest → verify → deliver → (optional) fire pipeline as a manually
 * submitted `POST /v1/attest/payment`, so a human no longer has to paste a
 * transaction id for the common case of "watch this address."
 */
import { parseTopicUri } from "@casid/core";
import type { Store } from "../lib/store";
import { getWatchCursor, listTopics, setWatchCursor } from "../lib/store";
import { attestPayment } from "./attestation";
import type { FlareContext } from "./flare";

interface XrplTx {
  meta?: { TransactionResult?: string };
  tx?: {
    TransactionType?: string;
    Destination?: string;
    hash?: string;
    ledger_index?: number;
  };
  ledger_index?: number;
  validated?: boolean;
}

function txLedgerIndex(entry: XrplTx): number {
  return entry.tx?.ledger_index ?? entry.ledger_index ?? 0;
}

/**
 * Pure filter/cursor-advance step, isolated from network + attestation I/O so
 * it's directly unit-testable: given a batch of `account_tx` entries and the
 * previous cursor, returns which entries are new, successful, incoming
 * Payments to `destination`, plus the cursor to persist afterward.
 */
export function selectNewPayments(
  txs: XrplTx[],
  destination: string,
  cursor: { lastLedgerIndex: number; lastTxHash?: string },
): { matched: Array<{ hash: string }>; nextLedgerIndex: number; nextTxHash?: string } {
  let nextLedgerIndex = cursor.lastLedgerIndex;
  let nextTxHash = cursor.lastTxHash;
  const matched: Array<{ hash: string }> = [];

  for (const entry of txs) {
    const tx = entry.tx;
    const ledgerIndex = txLedgerIndex(entry);
    if (ledgerIndex > nextLedgerIndex) nextLedgerIndex = ledgerIndex;
    if (!tx?.hash) continue;

    const isNewIncomingPayment =
      tx.TransactionType === "Payment" &&
      tx.Destination === destination &&
      entry.meta?.TransactionResult === "tesSUCCESS" &&
      tx.hash !== cursor.lastTxHash;

    if (isNewIncomingPayment) matched.push({ hash: tx.hash });
    nextTxHash = tx.hash;
  }

  return { matched, nextLedgerIndex, nextTxHash };
}

function xrplRpcUrl(flareChainId: number): string {
  if (process.env.XRPL_RPC_URL) return process.env.XRPL_RPC_URL;
  return flareChainId === 14 ? "https://xrplcluster.com/" : "https://s.altnet.rippletest.net:51234/";
}

async function fetchAccountTx(rpcUrl: string, address: string, minLedgerIndex: number): Promise<XrplTx[]> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      method: "account_tx",
      params: [
        {
          account: address,
          ledger_index_min: minLedgerIndex > 0 ? minLedgerIndex + 1 : -1,
          ledger_index_max: -1,
          limit: 50,
          forward: true,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`XRPL account_tx failed: ${res.status}`);
  const body = (await res.json()) as { result?: { transactions?: XrplTx[] } };
  return body.result?.transactions ?? [];
}

/** One poll pass over every active XRPL payment topic. Exported for direct testing. */
export async function pollOnce(store: Store, flare: FlareContext, signingSecret: string): Promise<void> {
  const rpcUrl = xrplRpcUrl(flare.chainId);
  const topics = listTopics(store).filter((t) => t.active && t.kind === "PAYMENT");

  for (const topic of topics) {
    let parsed;
    try {
      parsed = parseTopicUri(topic.uri);
    } catch {
      continue;
    }
    if (parsed.spec.kind !== "PAYMENT" || parsed.spec.chain !== "XRPL") continue;

    const destination = parsed.spec.destination;
    const cursor = getWatchCursor(store, topic.uri);

    let txs: XrplTx[];
    try {
      txs = await fetchAccountTx(rpcUrl, destination, cursor.lastLedgerIndex);
    } catch (err) {
      console.error(`[xrplWatcher] ${topic.uri}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    const { matched, nextLedgerIndex, nextTxHash } = selectNewPayments(txs, destination, cursor);

    for (const { hash } of matched) {
      try {
        const result = await attestPayment(store, flare, signingSecret, {
          topicUri: topic.uri,
          chain: "xrp",
          txHash: hash,
          deliver: true,
        });
        if (result.status === "recorded") {
          console.log(`[xrplWatcher] attested ${topic.uri} tx=${hash}`);
        }
      } catch (err) {
        console.error(`[xrplWatcher] attest failed for ${hash}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (txs.length > 0) {
      setWatchCursor(store, { topicUri: topic.uri, lastLedgerIndex: nextLedgerIndex, lastTxHash: nextTxHash });
    }
  }
}

/** Starts the interval poller. Returns a stop function. */
export function startXrplWatcher(
  store: Store,
  getFlare: () => Promise<FlareContext>,
  signingSecret: string,
): () => void {
  if (process.env.XRPL_WATCHER_ENABLED === "false") {
    return () => {};
  }
  const intervalMs = Number(process.env.XRPL_WATCHER_INTERVAL_MS ?? 20_000);

  const timer = setInterval(() => {
    getFlare()
      .then((flare) => pollOnce(store, flare, signingSecret))
      .catch((err) => console.error(`[xrplWatcher] poll error: ${err instanceof Error ? err.message : String(err)}`));
  }, intervalMs);

  return () => clearInterval(timer);
}
