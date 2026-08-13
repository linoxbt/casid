import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseTopicUri, type AttestedEvent, type WebhookDelivery } from "@casid/core";
import {
  createStore,
  createSubscription,
  createTopicRecord,
  deactivateSubscription,
  findTopicByUri,
  getDelivery,
  getWatchCursor,
  listDeliveries,
  listEvents,
  listSubscriptions,
  recordDelivery,
  recordEvent,
  setTopicCreatedBy,
  setWatchCursor,
  updateDeliveryStatus,
  type Store,
} from "./store";

let store: Store;
let dir: string;

const TOPIC_URI = "topic://payment/xrp/rTestDestination";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "casid-store-test-"));
  store = createStore(join(dir, "test.db"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("topics", () => {
  it("creates and finds a topic by URI", () => {
    const created = createTopicRecord(store, {
      uri: TOPIC_URI,
      kind: "PAYMENT",
      parsed: parseTopicUri(TOPIC_URI),
    });
    expect(created.uri).toBe(TOPIC_URI);
    expect(findTopicByUri(store, TOPIC_URI)?.id).toBe(created.id);
  });

  it("is idempotent for the same URI", () => {
    const first = createTopicRecord(store, {
      uri: TOPIC_URI,
      kind: "PAYMENT",
      parsed: parseTopicUri(TOPIC_URI),
    });
    const second = createTopicRecord(store, {
      uri: TOPIC_URI,
      kind: "PAYMENT",
      parsed: parseTopicUri(TOPIC_URI),
    });
    expect(second.id).toBe(first.id);
  });
});

describe("subscriptions", () => {
  it("creates, lists, and deactivates a subscription", () => {
    const sub = createSubscription(store, {
      topicUri: TOPIC_URI,
      webhookUrl: "https://example.com/hook",
    });
    expect(listSubscriptions(store).some((s) => s.id === sub.id && s.active)).toBe(true);

    const deactivated = deactivateSubscription(store, sub.id);
    expect(deactivated?.active).toBe(false);
    expect(listSubscriptions(store).find((s) => s.id === sub.id)?.active).toBe(false);
  });

  it("returns null when deactivating an unknown subscription", () => {
    expect(deactivateSubscription(store, "does-not-exist")).toBeNull();
  });

  it("rejects a non-https webhook URL", () => {
    expect(() =>
      createSubscription(store, { topicUri: TOPIC_URI, webhookUrl: "http://example.com" }),
    ).toThrow(/https/);
  });
});

describe("events", () => {
  it("regression: derives the mock column from payload.live instead of hardcoding 0", () => {
    const live: AttestedEvent = {
      id: crypto.randomUUID(),
      topicUri: TOPIC_URI,
      proofHash: "0xlive",
      eventCommitment: "0xlivecommit",
      attestationType: "PAYMENT",
      payload: { live: true },
      verified: true,
      createdAt: new Date().toISOString(),
    };
    const notLive: AttestedEvent = {
      id: crypto.randomUUID(),
      topicUri: TOPIC_URI,
      proofHash: "0xmock",
      eventCommitment: "0xmockcommit",
      attestationType: "PAYMENT",
      payload: {},
      verified: true,
      createdAt: new Date().toISOString(),
    };
    recordEvent(store, live);
    recordEvent(store, notLive);

    const liveRow = store.db
      .query("SELECT mock FROM events WHERE proof_hash = ?")
      .get("0xlive") as { mock: number };
    const mockRow = store.db
      .query("SELECT mock FROM events WHERE proof_hash = ?")
      .get("0xmock") as { mock: number };
    expect(liveRow.mock).toBe(0);
    expect(mockRow.mock).toBe(1);

    expect(listEvents(store, 10).some((e) => e.proofHash === "0xlive")).toBe(true);
  });

  it("supports a limit and a before cursor keyed by event id", () => {
    // Same createdAt timestamp for all three — regression test for the
    // pagination bug where a strict `created_at < ?` comparison would
    // silently drop same-millisecond siblings. Cursoring by rowid (via the
    // `before` event id) must not lose them.
    const sameInstant = new Date().toISOString();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const event: AttestedEvent = {
        id: crypto.randomUUID(),
        topicUri: TOPIC_URI,
        proofHash: `0xpage${i}`,
        eventCommitment: `0xcommit${i}`,
        attestationType: "PAYMENT",
        payload: { live: true },
        verified: true,
        createdAt: sameInstant,
      };
      recordEvent(store, event);
      ids.push(event.id);
    }
    const firstPage = listEvents(store, 1);
    expect(firstPage).toHaveLength(1);
    expect(firstPage[0]!.proofHash).toBe("0xpage2"); // most recently inserted (rowid DESC)

    const secondPage = listEvents(store, 10, firstPage[0]!.id);
    expect(secondPage.some((e) => e.proofHash === "0xpage1")).toBe(true);
    expect(secondPage.some((e) => e.proofHash === "0xpage0")).toBe(true);
    expect(secondPage.some((e) => e.id === firstPage[0]!.id)).toBe(false);
  });
});

describe("deliveries", () => {
  it("records and updates a delivery", () => {
    const delivery: WebhookDelivery = {
      id: crypto.randomUUID(),
      subscriptionId: "sub-1",
      eventId: "event-1",
      status: "pending",
      attempts: 0,
    };
    recordDelivery(store, delivery);
    updateDeliveryStatus(store, delivery.id, "delivered", {
      attempts: 1,
      deliveredAt: new Date().toISOString(),
    });
    const fetched = getDelivery(store, delivery.id);
    expect(fetched?.status).toBe("delivered");
    expect(fetched?.attempts).toBe(1);
    expect(listDeliveries(store, 10).some((d) => d.id === delivery.id)).toBe(true);
  });
});

describe("topic creator attribution", () => {
  it("records and updates the wallet address that created a topic", () => {
    const uri = "topic://payment/xrp/rAttributionTest";
    const created = createTopicRecord(store, { uri, kind: "PAYMENT", parsed: parseTopicUri(uri), createdBy: "0xabc" });
    expect(created.createdBy).toBe("0xabc");

    const updated = setTopicCreatedBy(store, uri, "0xdef");
    expect(updated?.createdBy).toBe("0xdef");
    expect(findTopicByUri(store, uri)?.createdBy).toBe("0xdef");
  });
});

describe("payment watch cursors", () => {
  it("defaults to ledger 0 for an unseen topic", () => {
    const cursor = getWatchCursor(store, "topic://payment/xrp/rNeverPolled");
    expect(cursor.lastLedgerIndex).toBe(0);
    expect(cursor.lastTxHash).toBeUndefined();
  });

  it("persists and advances a cursor", () => {
    const uri = "topic://payment/xrp/rWatchedDest";
    setWatchCursor(store, { topicUri: uri, lastLedgerIndex: 100, lastTxHash: "H1" });
    expect(getWatchCursor(store, uri)).toEqual({ topicUri: uri, lastLedgerIndex: 100, lastTxHash: "H1" });

    setWatchCursor(store, { topicUri: uri, lastLedgerIndex: 150, lastTxHash: "H2" });
    expect(getWatchCursor(store, uri)).toEqual({ topicUri: uri, lastLedgerIndex: 150, lastTxHash: "H2" });
  });
});
