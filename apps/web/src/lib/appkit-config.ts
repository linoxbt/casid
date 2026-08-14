"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { defineChain } from "viem";

// Cast through AppKitNetwork: bun's workspace install resolves more than one
// physical `viem` copy (transitive peer-dependency hashing), so TypeScript
// sees this chain's nested `viem.Chain`/`Client` types as structurally
// incompatible with the copy @reown/appkit-adapter-wagmi bundles, even
// though the actual runtime object is a plain, correctly-shaped chain
// definition. Not a real API mismatch — see the build log this replaced.
export const coston2 = defineChain({
  id: 114,
  name: "Flare Testnet Coston2",
  nativeCurrency: { name: "Coston2 Flare", symbol: "C2FLR", decimals: 18 },
  rpcUrls: { default: { http: ["https://coston2-api.flare.network/ext/C/rpc"] } },
  blockExplorers: {
    default: { name: "Coston2 Explorer", url: "https://coston2-explorer.flare.network" },
  },
  testnet: true,
}) as unknown as AppKitNetwork;

// WalletConnect's QR/relay flow needs a real Reown Cloud project id, but
// createAppKit() itself must run unconditionally and can't be skipped —
// useAppKit() (called by WalletProvider, which wraps every page, including
// statically prerendered ones) throws synchronously if createAppKit() never
// ran, and that throw can't be caught around the hook call without tripping
// react-hooks/rules-of-hooks. So: fall back to a placeholder id when
// NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID isn't set (CI, a fresh clone, a
// misconfigured preview). Injected-wallet connections work fine either way;
// only the WalletConnect QR path would fail, visibly, at connect time.
export const hasWalletConnect = Boolean(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID);
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "0".repeat(32);

export const wagmiAdapter = new WagmiAdapter({
  networks: [coston2],
  projectId,
  ssr: true,
});

createAppKit({
  adapters: [wagmiAdapter],
  networks: [coston2],
  defaultNetwork: coston2,
  projectId,
  metadata: {
    name: "Casid",
    description: "Verified economic event fabric for Flare",
    url: "https://casid.netlify.app",
    icons: ["https://casid.netlify.app/icon.svg"],
  },
  features: { analytics: false, email: false, socials: [] },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
