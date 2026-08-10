import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseTopicUri, type AttestedEvent } from "@casid/core";
import { createStore, createTopicRecord, recordEvent, type Store } from "../lib/store";
import { evaluateComposition } from "./composition";

let store: Store;
let dir: string;

const PAYMENT_URI = "topic://payment/xrp/rTestDestination";
const FTSO_URI = "topic://ftso/price/XRP-USD/threshold/gte/0.50";
const COMPOSITION_URI = `topic://composition/and/payment/xrp/rTestDestination+ftso/price/XRP-USD/threshold/gte/0.50`;

function seedEvent(topicUri: string): void {
  const event: AttestedEvent = {
    id: crypto.randomUUID(),
    topicUri,
    proofHash: `0x${crypto.randomUUID().replace(/-/g, "")}`,
    eventCommitment: `0x${crypto.randomUUID().replace(/-/g, "")}`,
    attestationType: parseTopicUri(topicUri).kind,
    payload: { live: true },
    verified: true,
    createdAt: new Date().toISOString(),
  };
  recordEvent(store, event);
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "casid-composition-test-"));
  store = createStore(join(dir, "test.db"));
  createTopicRecord(store, {
    uri: COMPOSITION_URI,
    kind: "COMPOSITION",
    parsed: parseTopicUri(COMPOSITION_URI),
  });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("evaluateComposition", () => {
  it("throws for a non-composition topic", () => {
    expect(() => evaluateComposition(store, "topic://payment/xrp/x")).toThrow(/Not a composition/);
  });

  it("is not satisfied when no children have matching events", () => {
    const result = evaluateComposition(store, COMPOSITION_URI);
    expect(result.op).toBe("and");
    expect(result.satisfied).toBe(false);
    expect(result.children).toHaveLength(2);
    expect(result.children.every((c) => !c.matched)).toBe(true);
  });

  it("is not satisfied for AND when only one child has a matching event", () => {
    seedEvent(PAYMENT_URI);
    const result = evaluateComposition(store, COMPOSITION_URI);
    expect(result.satisfied).toBe(false);
    const payment = result.children.find((c) => c.uri === PAYMENT_URI);
    const ftso = result.children.find((c) => c.uri === FTSO_URI);
    expect(payment?.matched).toBe(true);
    expect(ftso?.matched).toBe(false);
  });

  it("is satisfied for AND once all children have matching events", () => {
    seedEvent(FTSO_URI);
    const result = evaluateComposition(store, COMPOSITION_URI);
    expect(result.satisfied).toBe(true);
    expect(result.children.every((c) => c.matched)).toBe(true);
  });
});
