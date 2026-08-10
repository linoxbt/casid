import { describe, expect, it, afterEach } from "bun:test";
import {
  hasValidApiKey,
  originAllowed,
  requireConfiguredSecrets,
  validateWebhookUrl,
} from "./security";

const ENV_KEYS = ["CASID_API_KEY", "CORS_ORIGINS", "NODE_ENV", "WEBHOOK_SIGNING_SECRET"] as const;
const saved: Record<string, string | undefined> = {};

function stash() {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
}
function restore() {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
}

describe("validateWebhookUrl", () => {
  it("accepts a valid https URL", () => {
    expect(validateWebhookUrl("https://example.com/hook")).toBe("https://example.com/hook");
  });

  it("returns undefined for an empty/missing URL", () => {
    expect(validateWebhookUrl(undefined)).toBeUndefined();
    expect(validateWebhookUrl("")).toBeUndefined();
  });

  it("rejects http (non-tls)", () => {
    expect(() => validateWebhookUrl("http://example.com/hook")).toThrow(/https/);
  });

  it("rejects localhost and loopback", () => {
    expect(() => validateWebhookUrl("https://localhost/hook")).toThrow(/local or private/);
    expect(() => validateWebhookUrl("https://127.0.0.1/hook")).toThrow(/local or private/);
  });

  it("rejects private IPv4 ranges", () => {
    expect(() => validateWebhookUrl("https://10.0.0.5/hook")).toThrow(/local or private/);
    expect(() => validateWebhookUrl("https://192.168.1.5/hook")).toThrow(/local or private/);
    expect(() => validateWebhookUrl("https://172.16.0.5/hook")).toThrow(/local or private/);
  });

  it("rejects IPv6 hosts", () => {
    expect(() => validateWebhookUrl("https://[::1]/hook")).toThrow(/local or private/);
  });

  it("rejects malformed URLs", () => {
    expect(() => validateWebhookUrl("not a url")).toThrow(/valid URL/);
  });
});

describe("hasValidApiKey", () => {
  afterEach(restore);

  it("accepts any request in dev mode when no key is configured", () => {
    stash();
    delete process.env.CASID_API_KEY;
    process.env.NODE_ENV = "development";
    expect(hasValidApiKey(undefined)).toBe(true);
  });

  it("requires a matching bearer token once configured", () => {
    stash();
    process.env.CASID_API_KEY = "secret-key";
    expect(hasValidApiKey("Bearer secret-key")).toBe(true);
    expect(hasValidApiKey("Bearer wrong-key")).toBe(false);
    expect(hasValidApiKey(undefined)).toBe(false);
  });
});

describe("originAllowed", () => {
  afterEach(restore);

  it("allows any origin in dev mode when no allow-list is configured", () => {
    stash();
    delete process.env.CORS_ORIGINS;
    process.env.NODE_ENV = "development";
    expect(originAllowed("https://anything.example")).toBe("https://anything.example");
  });

  it("only allows listed origins once configured", () => {
    stash();
    process.env.CORS_ORIGINS = "https://a.example, https://b.example";
    expect(originAllowed("https://a.example")).toBe("https://a.example");
    expect(originAllowed("https://evil.example")).toBeUndefined();
  });
});

describe("requireConfiguredSecrets", () => {
  afterEach(restore);

  it("is a no-op in dev mode", () => {
    stash();
    process.env.NODE_ENV = "development";
    expect(() => requireConfiguredSecrets()).not.toThrow();
  });

  it("throws in production when secrets are missing", () => {
    stash();
    process.env.NODE_ENV = "production";
    delete process.env.CASID_API_KEY;
    delete process.env.WEBHOOK_SIGNING_SECRET;
    expect(() => requireConfiguredSecrets()).toThrow(/CASID_API_KEY/);
  });

  it("passes in production once both secrets are set", () => {
    stash();
    process.env.NODE_ENV = "production";
    process.env.CASID_API_KEY = "k";
    process.env.WEBHOOK_SIGNING_SECRET = "s";
    expect(() => requireConfiguredSecrets()).not.toThrow();
  });
});
