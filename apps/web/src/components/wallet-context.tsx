"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createWalletClient, custom, type Address } from "viem";
import {
  COSTON2_ADD_CHAIN_PARAMS,
  COSTON2_CHAIN_ID,
  COSTON2_CHAIN_ID_HEX,
  getInjectedProvider,
} from "@/lib/wallet";

interface WalletState {
  address: Address | null;
  chainId: number | null;
  isConnecting: boolean;
  error: string | null;
  hasProvider: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  ensureCoston2: () => Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasProvider, setHasProvider] = useState(false);

  useEffect(() => {
    const provider = getInjectedProvider();
    setHasProvider(Boolean(provider));
    if (!provider) return;

    // Reconnect silently if already authorized (no popup for eth_accounts).
    provider
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const list = accounts as string[];
        if (list?.[0]) setAddress(list[0] as Address);
      })
      .catch(() => {});
    provider
      .request({ method: "eth_chainId" })
      .then((id) => setChainId(Number.parseInt(id as string, 16)))
      .catch(() => {});

    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAddress((accounts?.[0] as Address) ?? null);
    };
    const onChainChanged = (...args: unknown[]) => {
      setChainId(Number.parseInt(args[0] as string, 16));
    };
    provider.on?.("accountsChanged", onAccountsChanged);
    provider.on?.("chainChanged", onChainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) {
      setError("No browser wallet found — install MetaMask or another injected wallet.");
      return;
    }
    setError(null);
    setIsConnecting(true);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      if (accounts[0]) setAddress(accounts[0] as Address);
      const id = (await provider.request({ method: "eth_chainId" })) as string;
      setChainId(Number.parseInt(id, 16));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  const ensureCoston2 = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) throw new Error("No browser wallet found.");
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: COSTON2_CHAIN_ID_HEX }],
      });
    } catch (switchErr) {
      const code = (switchErr as { code?: number })?.code;
      if (code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [COSTON2_ADD_CHAIN_PARAMS],
        });
      } else {
        throw switchErr;
      }
    }
    setChainId(COSTON2_CHAIN_ID);
  }, []);

  return (
    <WalletContext.Provider
      value={{ address, chainId, isConnecting, error, hasProvider, connect, disconnect, ensureCoston2 }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}

/** Wallet client bound to the injected provider, for sending a transaction. */
export function getWalletClient(account: Address) {
  const provider = getInjectedProvider();
  if (!provider) throw new Error("No browser wallet found.");
  return createWalletClient({ account, transport: custom(provider) });
}
