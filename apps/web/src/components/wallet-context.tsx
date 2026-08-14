"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useAccount, useDisconnect, useSwitchChain } from "wagmi";
import { getWalletClient as wagmiGetWalletClient } from "@wagmi/core";
import { useAppKit } from "@reown/appkit/react";
import type { Address } from "viem";
import { COSTON2_CHAIN_ID } from "@/lib/wallet";
import { wagmiConfig } from "@/lib/appkit-config";

interface WalletState {
  address: Address | null;
  chainId: number | null;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  ensureCoston2: () => Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { address, chainId, status } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { open } = useAppKit();
  const [error, setError] = useState<string | null>(null);

  const connect = useMemo(
    () => async () => {
      setError(null);
      try {
        await open();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [open],
  );

  const disconnect = useMemo(() => () => wagmiDisconnect(), [wagmiDisconnect]);

  const ensureCoston2 = useMemo(
    () => async () => {
      setError(null);
      try {
        await switchChainAsync({ chainId: COSTON2_CHAIN_ID });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        throw e;
      }
    },
    [switchChainAsync],
  );

  const value = useMemo<WalletState>(
    () => ({
      address: (address as Address | undefined) ?? null,
      chainId: chainId ?? null,
      isConnecting: status === "connecting" || status === "reconnecting",
      error,
      connect,
      disconnect,
      ensureCoston2,
    }),
    [address, chainId, status, error, connect, disconnect, ensureCoston2],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}

/** Wallet client bound to the connected wagmi/Reown account, for sending a transaction. */
export function getWalletClient(account: Address) {
  return wagmiGetWalletClient(wagmiConfig, { account });
}
