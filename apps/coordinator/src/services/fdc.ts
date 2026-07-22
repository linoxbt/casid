/**
 * FDC attestation pipeline for Casid.
 *
 * Production flow:
 *  1. Prepare attestation request (type + source + request body + MIC)
 *  2. FdcHub.requestAttestation{value: fee}()
 *  3. Wait for voting round finalization
 *  4. Fetch proof from DA Layer
 *  5. Submit to ProofVerifier / TriggerExecutor
 *
 * MVP: full mock path with identical response shape; live request when
 * FDC_MODE=live and FdcHub is resolvable.
 */

import type { FlareContext } from "./flare";

export type FdcMode = "mock" | "live";

export function fdcMode(): FdcMode {
  return process.env.FDC_MODE === "live" ? "live" : "mock";
}

export type PaymentAttestationRequest = {
  chain: "XRPL" | "BTC" | "DOGE";
  txId: string;
  inUtxo?: number;
};

export type FdcRequestReceipt = {
  mode: FdcMode;
  status: "queued" | "submitted" | "finalized" | "mock_complete";
  votingRound?: number;
  requestHash?: string;
  txHash?: string;
  submittedAt: string;
  notes: string[];
};

/**
 * Submit (or mock) a Payment attestation request.
 * Live path requires DEPLOYER_PRIVATE_KEY + FdcHub + fee in C2FLR.
 */
export async function requestPaymentAttestation(
  ctx: FlareContext,
  req: PaymentAttestationRequest,
): Promise<FdcRequestReceipt> {
  const mode = fdcMode();
  const notes: string[] = [];

  if (mode === "mock" || !ctx.addresses.FdcHub) {
    notes.push(
      mode === "live" && !ctx.addresses.FdcHub
        ? "FdcHub unresolved — falling back to mock"
        : "FDC_MODE=mock — simulating attestation round",
    );
    notes.push(
      `Would attest Payment on ${req.chain} tx=${req.txId}${req.inUtxo != null ? ` utxo=${req.inUtxo}` : ""}`,
    );
    notes.push(`DA Layer: ${ctx.daLayer}`);
    notes.push(
      "Production: encode ABI request → requestAttestation → poll round → GET proof",
    );

    return {
      mode: "mock",
      status: "mock_complete",
      requestHash: `0x${Buffer.from(`${req.chain}:${req.txId}`).toString("hex").padEnd(64, "0").slice(0, 64)}`,
      submittedAt: new Date().toISOString(),
      notes,
    };
  }

  // Live scaffolding: we record intent. Full ABI encoding of Payment attestation
  // requires verifier-server MIC computation (see Flare FDC docs).
  notes.push("Live FDC path enabled — MIC/request ABI packaging required");
  notes.push(`FdcHub=${ctx.addresses.FdcHub}`);
  notes.push(
    "Set FDC_VERIFIER_URL and implement preparePaymentRequest() for full live flow",
  );

  return {
    mode: "live",
    status: "queued",
    submittedAt: new Date().toISOString(),
    notes,
  };
}

export type DaProofResult = {
  found: boolean;
  mode: FdcMode;
  proof?: string;
  response?: Record<string, unknown>;
  error?: string;
};

/** Fetch proof from DA Layer (or return mock proof package). */
export async function fetchDaProof(
  ctx: FlareContext,
  opts: { votingRound?: number; requestBytes?: string; mockPayload?: Record<string, unknown> },
): Promise<DaProofResult> {
  const mode = fdcMode();

  if (mode === "mock" || opts.mockPayload) {
    const payload = opts.mockPayload ?? { mock: true };
    const proof = `0x${Buffer.from(JSON.stringify(payload)).toString("hex")}`;
    return {
      found: true,
      mode: "mock",
      proof,
      response: payload,
    };
  }

  try {
    // DA Layer endpoints vary by deployment; try a health probe first
    const base = ctx.daLayer.replace(/\/$/, "");
    const health = await fetch(`${base}/api/health`, {
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    if (!health?.ok) {
      return {
        found: false,
        mode: "live",
        error: `DA Layer not reachable at ${base}`,
      };
    }

    return {
      found: false,
      mode: "live",
      error:
        "DA Layer reachable but specific proof query not yet configured — see FDC docs getProof",
    };
  } catch (err) {
    return {
      found: false,
      mode: "live",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function describeFdcIntegration(): Record<string, unknown> {
  return {
    mode: fdcMode(),
    steps: [
      "Identify attestation type (Payment | EVMTransaction | Web2Json | …)",
      "Compute MIC via verifier / prepare request body",
      "FdcHub.requestAttestation{value: fee}(abiEncodedRequest)",
      "Wait for Relay voting round finalization",
      "Fetch Merkle proof from DA Layer",
      "ProofVerifier.verifyAndConsume → TriggerExecutor.fireWithProof",
    ],
    docs: "https://dev.flare.network/fdc/overview",
  };
}
