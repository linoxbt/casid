import { TOPIC_REGISTRY_ADDRESS } from "@/lib/wallet";
import type { CasidEvent } from "@/lib/api";

const EXPLORER = "https://coston2-explorer.flare.network";

/** The on-chain tx hash for a verified event, if it was fired on-chain. */
export function eventTxHash(event: Pick<CasidEvent, "payload">): string | null {
  const candidate =
    event.payload.submitTx ?? event.payload.txHash ?? event.payload.onChainTx;
  return typeof candidate === "string" && candidate.startsWith("0x") ? candidate : null;
}

export function isOnChain(event: Pick<CasidEvent, "payload">): boolean {
  return eventTxHash(event) !== null;
}

export function explorerTxHref(txHash: string): string {
  return `${EXPLORER}/tx/${txHash}`;
}

export function explorerAddressHref(address: string): string {
  return `${EXPLORER}/address/${address}`;
}

export function explorerSearchHref(query: string): string {
  return `${EXPLORER}/search-results?q=${encodeURIComponent(query)}`;
}

/** Best available explorer link for an event: the exact tx if fired on-chain, else a proof-hash search. */
export function eventExplorerHref(event: Pick<CasidEvent, "payload" | "proofHash">): string {
  const tx = eventTxHash(event);
  return tx ? explorerTxHref(tx) : explorerSearchHref(event.proofHash);
}

/** Topics register on-chain via TopicRegistry; onChainId is set once that succeeds. */
export function topicExplorerHref(): string | null {
  return TOPIC_REGISTRY_ADDRESS ? explorerAddressHref(TOPIC_REGISTRY_ADDRESS) : null;
}
