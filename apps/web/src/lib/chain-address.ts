/**
 * Casid's payment topics target XRPL/BTC/DOGE destinations, none of which
 * are EVM-compatible — an 0x… address is never valid here, even though
 * it's the one format users connecting a wallet see constantly. Validate
 * against each chain's real address shape instead of accepting anything.
 */

export type PaymentChain = "xrp" | "btc" | "doge";

const EVM_RE = /^0x[a-fA-F0-9]{40}$/;

const CHAIN_PATTERNS: Record<PaymentChain, { re: RegExp; label: string; hint: string }> = {
  xrp: {
    re: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
    label: "XRP",
    hint: 'XRPL classic addresses start with "r" — e.g. rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH.',
  },
  btc: {
    re: /^([13][a-km-zA-HJ-NP-Z1-9]{25,34}|(bc1|tb1)[a-z0-9]{25,90})$/,
    label: "BTC",
    hint: 'Bitcoin addresses start with "1", "3", or "bc1"/"tb1" (SegWit).',
  },
  doge: {
    re: /^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/,
    label: "DOGE",
    hint: 'Dogecoin addresses start with "D" and are 34 characters long.',
  },
};

/** Returns an error message if the address doesn't match the chain's real format, or null if it's valid. */
export function validateChainAddress(chain: PaymentChain, address: string): string | null {
  const trimmed = address.trim();
  if (!trimmed) return "Enter an address.";
  const pattern = CHAIN_PATTERNS[chain];
  if (EVM_RE.test(trimmed)) {
    return `That's an EVM wallet address (0x…) — ${pattern.label} is not EVM-compatible. ${pattern.hint}`;
  }
  if (!pattern.re.test(trimmed)) {
    return `That doesn't look like a valid ${pattern.label} address. ${pattern.hint}`;
  }
  return null;
}

export function addressHint(chain: PaymentChain): string {
  return CHAIN_PATTERNS[chain].hint;
}

export function addressPlaceholder(chain: PaymentChain): string {
  switch (chain) {
    case "xrp":
      return "rYourXRPLAddress...";
    case "btc":
      return "bc1YourBTCAddress... or 1YourBTCAddress...";
    case "doge":
      return "DYourDogeAddress...";
  }
}
