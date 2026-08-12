"use client";

import { useWallet } from "./wallet-context";
import { COSTON2_CHAIN_ID } from "@/lib/wallet";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="14" height="9.5" rx="2" />
      <path d="M2 8h14" />
      <circle cx="12.5" cy="11" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const { address, isConnecting, connect, disconnect, chainId, ensureCoston2, error } = useWallet();

  if (!address) {
    return (
      <button
        type="button"
        className="btn btn-ghost wallet-btn"
        onClick={() => void connect()}
        disabled={isConnecting}
        title={error ?? "Connect wallet"}
      >
        <WalletIcon />
        {!compact && (isConnecting ? "Connecting…" : "Connect wallet")}
      </button>
    );
  }

  const wrongNetwork = chainId !== null && chainId !== COSTON2_CHAIN_ID;

  if (compact) {
    return (
      <button type="button" className="btn btn-ghost wallet-btn" onClick={disconnect} title={short(address)}>
        <span className="wallet-dot" />
      </button>
    );
  }

  return (
    <div className="wallet-connected">
      {wrongNetwork && (
        <button
          type="button"
          className="wallet-switch"
          onClick={() => void ensureCoston2()}
        >
          Switch to Coston2
        </button>
      )}
      <button type="button" className="btn btn-ghost wallet-btn" onClick={disconnect} title="Disconnect">
        <span className="wallet-dot" />
        {short(address)}
      </button>
    </div>
  );
}
