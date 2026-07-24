import { isIP } from "node:net";

const PRIVATE_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return false;
  }
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 127 ||
    a === 0
  );
}

export function isDevMode(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function requireConfiguredSecrets(): void {
  if (isDevMode()) return;
  if (!process.env.CASID_API_KEY) {
    throw new Error("CASID_API_KEY is required in production");
  }
  if (!process.env.WEBHOOK_SIGNING_SECRET) {
    throw new Error("WEBHOOK_SIGNING_SECRET is required in production");
  }
}

export function originAllowed(origin?: string | null): string | undefined {
  const allowed = process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean);
  if (!allowed?.length) return isDevMode() ? origin ?? "*" : undefined;
  if (!origin) return undefined;
  return allowed.includes(origin) ? origin : undefined;
}

export function hasValidApiKey(authHeader?: string | null): boolean {
  const configured = process.env.CASID_API_KEY;
  if (!configured) return isDevMode();
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  return token === configured;
}

export function validateWebhookUrl(raw?: string): string | undefined {
  const url = raw?.trim();
  if (!url) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("webhookUrl must be a valid URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("webhookUrl must use https://");
  }

  const host = parsed.hostname.toLowerCase();
  if (PRIVATE_HOSTS.has(host) || isPrivateIpv4(host) || isIP(host) === 6) {
    throw new Error("webhookUrl cannot target local or private hosts");
  }

  return parsed.toString();
}
