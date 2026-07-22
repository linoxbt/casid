/**
 * HMAC-SHA256 webhook signing (Stripe-style).
 * Header: X-Casid-Signature: t={unix},v1={hex}
 */

export async function signWebhookPayload(
  secret: string,
  body: string,
  timestampSec: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const signed = `${timestampSec}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
  const hex = bufferToHex(sig);
  return `t=${timestampSec},v1=${hex}`;
}

export async function verifyWebhookSignature(
  secret: string,
  body: string,
  header: string,
  toleranceSec = 300,
): Promise<boolean> {
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    }),
  ) as Record<string, string | undefined>;

  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!t || !v1) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > toleranceSec) return false;

  const expected = await signWebhookPayload(secret, body, t);
  const expectedV1 = expected.split("v1=")[1];
  return timingSafeEqual(expectedV1 ?? "", v1);
}

function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** Deterministic event id / proof hash helpers for demo mode */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return bufferToHex(digest);
}

export async function proofHashFromPayload(payload: Record<string, unknown>): Promise<`0x${string}`> {
  const hex = await sha256Hex(JSON.stringify(payload));
  return `0x${hex}`;
}
