import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let dir: string;
let server: { fetch: (req: Request) => Response | Promise<Response> };

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "casid-index-test-"));
  process.env.DATABASE_PATH = join(dir, "test.db");
  process.env.NODE_ENV = "development";
  // Non-Flare chain id so resolveFlareContext() skips real network calls to
  // the Flare contract registry, keeping this test hermetic and fast.
  process.env.FLARE_CHAIN_ID = "31337";
  delete process.env.CASID_API_KEY;
  delete process.env.TOPIC_REGISTRY_ADDRESS;
  delete process.env.PROOF_VERIFIER_ADDRESS;

  const mod = await import("./index");
  server = mod.default;
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("GET /health", () => {
  it("reports real counts from the store", async () => {
    const res = await server.fetch(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      topics: number;
      events: number;
      onChainVerification: string;
    };
    expect(body.ok).toBe(true);
    expect(typeof body.topics).toBe("number");
    expect(typeof body.events).toBe("number");
    // No PROOF_VERIFIER_ADDRESS configured in this test env.
    expect(body.onChainVerification).toBe("unknown");
  });
});

describe("POST /v1/topics", () => {
  it("rejects unauthenticated writes when an API key is configured", async () => {
    process.env.CASID_API_KEY = "test-key";
    try {
      const res = await server.fetch(
        new Request("http://localhost/v1/topics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uri: "topic://payment/xrp/rShouldBeRejected" }),
        }),
      );
      expect(res.status).toBe(401);
    } finally {
      delete process.env.CASID_API_KEY;
    }
  });

  it("creates a topic with a valid request", async () => {
    const res = await server.fetch(
      new Request("http://localhost/v1/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri: "topic://payment/xrp/rIndexTestDestination" }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { topic: { uri: string; kind: string } };
    expect(body.topic.uri).toBe("topic://payment/xrp/rIndexTestDestination");
    expect(body.topic.kind).toBe("PAYMENT");
  });

  it("rejects a malformed topic URI", async () => {
    const res = await server.fetch(
      new Request("http://localhost/v1/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri: "not-a-topic-uri" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("rate limiting", () => {
  it("returns 429 once the attest-route limit is exceeded", async () => {
    process.env.RATE_LIMIT_MAX = "2";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";
    try {
      const req = () =>
        server.fetch(
          new Request("http://localhost/v1/attest/ftso", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topicUri: "topic://ftso/price/DOES-NOT/threshold/gte/1" }),
          }),
        );
      const first = await req();
      const second = await req();
      const third = await req();
      expect(first.status).not.toBe(429);
      expect(second.status).not.toBe(429);
      expect(third.status).toBe(429);
    } finally {
      delete process.env.RATE_LIMIT_MAX;
      delete process.env.RATE_LIMIT_WINDOW_MS;
    }
  });
});
