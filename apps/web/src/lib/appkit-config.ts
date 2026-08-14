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

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const wagmiAdapter = new WagmiAdapter({
  networks: [coston2],
  projectId,
  ssr: true,
});

// createAppKit() must run unconditionally, including during SSR/SSG — the
// `ssr: true` WagmiAdapter option above makes that safe, and useAppKit()
// (called by WalletProvider, which wraps every page including statically
// prerendered ones) throws if createAppKit() hasn't run yet. Only guard on
// the project id being configured (see .env.example), so a preview build
// without it doesn't crash.
if (projectId) {
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
}

export const wagmiConfig = wagmiAdapter.wagmiConfig;
