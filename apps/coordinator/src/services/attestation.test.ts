import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseTopicUri } from "@casid/core";
import { createStore, createTopicRecord, type Store } from "../lib/store";
import { recordFtsoEvent, recordPaymentEvent } from "./attestation";

let store: Store;
let dir: string;

const PAYMENT_URI = "topic://payment/xrp/rTestDestination";
const FTSO_URI = "topic://ftso/price/XRP-USD/threshold/gte/0.50";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "casid-attestation-test-"));
  store = createStore(join(dir, "test.db"));
  createTopicRecord(store, { uri: PAYMENT_URI, kind: "PAYMENT", parsed: parseTopicUri(PAYMENT_URI) });
  createTopicRecord(store, { uri: FTSO_URI, kind: "FTSO_THRESHOLD", parsed: parseTopicUri(FTSO_URI) });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("recordPaymentEvent", () => {
  it("records a verified event for a PAYMENT topic", async () => {
    const event = await recordPaymentEvent(store, {
      topicUri: PAYMENT_URI,
      txHash: "ABCDEF1234",
      amount: "1000000",
      proofResponse: { ok: true },
    });
    expect(event.verified).toBe(true);
    expect(event.attestationType).toBe("PAYMENT");
    expect(event.payload.live).toBe(true);
  });

  it("rejects an unknown topic", async () => {
    await expect(
      recordPaymentEvent(store, {
        topicUri: "topic://payment/xrp/rNotRegistered",
        proofResponse: {},
      }),
    ).rejects.toThrow(/Topic not found/);
  });

  it("rejects a topic whose kind is not PAYMENT", async () => {
    await expect(
      recordPaymentEvent(store, { topicUri: FTSO_URI, proofResponse: {} }),
    ).rejects.toThrow(/not PAYMENT/);
  });
});

describe("recordFtsoEvent", () => {
  it("records a verified event when the observed price crosses the threshold", async () => {
    const event = await recordFtsoEvent(store, FTSO_URI, 0.6);
    expect(event.verified).toBe(true);
    expect(event.payload.crossed).toBe(true);
  });

  it("rejects when the observed price does not cross the threshold", async () => {
    await expect(recordFtsoEvent(store, FTSO_URI, 0.1)).rejects.toThrow(/does not satisfy/);
  });

  it("regression: no longer fabricates a passing price when none is supplied", async () => {
    // Previously: observedPrice ?? threshold * 1.1 silently manufactured a
    // passing price. Now observedPrice is required — an undefined price must
    // not silently produce a "verified" event.
    await expect(
      recordFtsoEvent(store, FTSO_URI, undefined as unknown as number),
    ).rejects.toThrow(/does not satisfy/);
  });
});
