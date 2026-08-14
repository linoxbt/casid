"use client";

import { useEffect, useState } from "react";
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

function ChevronIcon() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4.5 6 7.5 9 4.5" />
    </svg>
  );
}

export function WalletButton() {
  const { address, isConnecting, connect, disconnect, chainId, ensureCoston2, error } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  if (!address) {
    return (
      <div className="wallet-widget">
        <button
          type="button"
          className="btn btn-primary wallet-btn"
          onClick={() => void connect()}
          disabled={isConnecting}
        >
          <WalletIcon />
          {isConnecting ? "Connecting…" : "Connect wallet"}
        </button>
        {error && <p className="wallet-error">{error}</p>}
      </div>
    );
  }

  const wrongNetwork = chainId !== null && chainId !== COSTON2_CHAIN_ID;

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="wallet-widget">
      {wrongNetwork && (
        <button type="button" className="wallet-switch" onClick={() => void ensureCoston2()}>
          Switch to Coston2
        </button>
      )}
      <button
        type="button"
        className="btn btn-ghost wallet-btn"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <span className={`wallet-dot ${wrongNetwork ? "warn" : ""}`} />
        {short(address)}
        <ChevronIcon />
      </button>
      {menuOpen && (
        <>
          <div className="wallet-menu-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="wallet-menu" role="menu">
            <button type="button" className="wallet-menu-item" onClick={() => void copyAddress()}>
              {copied ? "Copied" : "Copy address"}
            </button>
            <a
              className="wallet-menu-item"
              href={`https://coston2-explorer.flare.network/address/${address}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => setMenuOpen(false)}
            >
              View on explorer
            </a>
            <button
              type="button"
              className="wallet-menu-item wallet-menu-item-danger"
              onClick={() => {
                setMenuOpen(false);
                disconnect();
              }}
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
