import type {
  AttestedEvent,
  DeliveryStatus,
  Subscription,
  WebhookDelivery,
} from "@casid/core";
import { parseTopicUri, type ParsedTopic } from "@casid/core";
import { openDb, type Db } from "./db";
import { validateWebhookUrl } from "../services/security";

export interface TopicRecord {
  id: string;
  onChainId?: number;
  uri: string;
  kind: string;
  parsed: ParsedTopic;
  createdAt: string;
  active: boolean;
  createdBy?: string;
}

/** Compatibility façade — still exposes Map-like sizes for health. */
export interface Store {
  db: Db;
  get topics(): { size: number };
  get subscriptions(): { size: number };
  get events(): { size: number };
  get deliveries(): { size: number };
}

export function createStore(dbPath?: string): Store {
  const db = openDb(dbPath);
  const store: Store = {
    db,
    get topics() {
      const row = db.query("SELECT COUNT(*) as c FROM topics").get() as {
        c: number;
      };
      return { size: row.c };
    },
    get subscriptions() {
      const row = db
        .query("SELECT COUNT(*) as c FROM subscriptions WHERE active = 1")
        .get() as { c: number };
      return { size: row.c };
    },
    get events() {
      const row = db.query("SELECT COUNT(*) as c FROM events").get() as {
        c: number;
      };
      return { size: row.c };
    },
    get deliveries() {
      const row = db.query("SELECT COUNT(*) as c FROM deliveries").get() as {
        c: number;
      };
      return { size: row.c };
    },
  };
  return store;
}

function rowToTopic(row: {
  id: string;
  on_chain_id: number | null;
  uri: string;
  kind: string;
  schema_hash_input: string | null;
  created_at: string;
  active: number;
  created_by: string | null;
}): TopicRecord {
  let parsed: ParsedTopic;
  try {
    parsed = parseTopicUri(row.uri);
  } catch {
    parsed = {
      uri: row.uri,
      kind: row.kind as ParsedTopic["kind"],
      spec: { kind: "PAYMENT", chain: "XRPL", destination: "unknown" },
      schemaHashInput: row.schema_hash_input ?? row.uri,
    };
  }
  return {
    id: row.id,
    onChainId: row.on_chain_id ?? undefined,
    uri: row.uri,
    kind: row.kind,
    parsed,
    createdAt: row.created_at,
    active: row.active === 1,
    createdBy: row.created_by ?? undefined,
  };
}

export function seedStarterTopics(store: Store): void {
  const count = store.topics.size;
  if (count > 0) return;

  const starterTopics = [
    "topic://ftso/price/XRP-USD/threshold/gte/0.50",
    "topic://fasset/mint/FXRP",
  ];

  let onChainId = 1;
  for (const uri of starterTopics) {
    try {
      const parsed = parseTopicUri(uri);
      insertTopic(store, {
        id: crypto.randomUUID(),
        uri,
        kind: parsed.kind,
        parsed,
        createdAt: new Date().toISOString(),
        active: true,
        onChainId: onChainId++,
      });
    } catch {
      /* skip */
    }
  }
}

const TOPIC_COLUMNS =
  "id, on_chain_id, uri, kind, schema_hash_input, created_at, active, created_by";

type TopicRow = {
  id: string;
  on_chain_id: number | null;
  uri: string;
  kind: string;
  schema_hash_input: string | null;
  created_at: string;
  active: number;
  created_by: string | null;
};

function insertTopic(store: Store, t: TopicRecord): void {
  store.db
    .query(
      `INSERT INTO topics(id, on_chain_id, uri, kind, schema_hash_input, created_at, active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      t.id,
      t.onChainId ?? null,
      t.uri,
      t.kind,
      t.parsed.schemaHashInput,
      t.createdAt,
      t.active ? 1 : 0,
      t.createdBy ?? null,
    );
}

export function listTopics(store: Store): TopicRecord[] {
  const rows = store.db
    .query(`SELECT ${TOPIC_COLUMNS} FROM topics ORDER BY created_at DESC`)
    .all() as TopicRow[];
  return rows.map(rowToTopic);
}

export function getTopicById(store: Store, id: string): TopicRecord | undefined {
  const row = store.db
    .query(`SELECT ${TOPIC_COLUMNS} FROM topics WHERE id = ?`)
    .get(id) as TopicRow | null;
  return row ? rowToTopic(row) : undefined;
}

export function findTopicByUri(
  store: Store,
  uri: string,
): TopicRecord | undefined {
  const row = store.db
    .query(`SELECT ${TOPIC_COLUMNS} FROM topics WHERE uri = ?`)
    .get(uri) as TopicRow | null;
  return row ? rowToTopic(row) : undefined;
}

export function createTopicRecord(
  store: Store,
  input: { uri: string; kind: string; parsed: ParsedTopic; onChainId?: number; createdBy?: string },
): TopicRecord {
  const existing = findTopicByUri(store, input.uri);
  if (existing) return existing;

  const maxRow = store.db
    .query("SELECT COALESCE(MAX(on_chain_id), 0) as m FROM topics")
    .get() as { m: number };

  const t: TopicRecord = {
    id: crypto.randomUUID(),
    uri: input.uri,
    kind: input.kind,
    parsed: input.parsed,
    createdAt: new Date().toISOString(),
    active: true,
    onChainId: input.onChainId ?? maxRow.m + 1,
    createdBy: input.createdBy,
  };
  insertTopic(store, t);
  return t;
}

/** Records the wallet address that signed a topic's on-chain createTopic tx directly (bypassing the coordinator's relay key). */
export function setTopicCreatedBy(store: Store, uri: string, address: string): TopicRecord | undefined {
  store.db.query("UPDATE topics SET created_by = ? WHERE uri = ?").run(address, uri);
  return findTopicByUri(store, uri);
}

export function createSubscription(
  store: Store,
  input: {
    topicUri: string;
    webhookUrl?: string;
    targetAddress?: string;
  },
): Subscription {
  const topic = findTopicByUri(store, input.topicUri);
  if (!topic) throw new Error(`Unknown topic: ${input.topicUri}`);
  const webhookUrl = validateWebhookUrl(input.webhookUrl);

  // Idempotent: same topic + webhook
  if (webhookUrl) {
    const existing = store.db
      .query(
        `SELECT id, topic_uri, topic_id, webhook_url, target_address, active, created_at, credit
         FROM subscriptions WHERE topic_uri = ? AND webhook_url = ? AND active = 1 LIMIT 1`,
      )
      .get(input.topicUri, webhookUrl) as
      | {
          id: string;
          topic_uri: string;
          topic_id: number | null;
          webhook_url: string | null;
          target_address: string | null;
          active: number;
          created_at: string;
          credit: string | null;
        }
      | null;
    if (existing) {
      return {
        id: existing.id,
        topicUri: existing.topic_uri,
        topicId: existing.topic_id ?? undefined,
        webhookUrl: existing.webhook_url ?? undefined,
        targetAddress: existing.target_address ?? undefined,
        active: existing.active === 1,
        createdAt: existing.created_at,
        credit: existing.credit ?? undefined,
      };
    }
  }

  const sub: Subscription = {
    id: crypto.randomUUID(),
    topicUri: input.topicUri,
    topicId: topic.onChainId,
    webhookUrl,
    targetAddress: input.targetAddress,
    active: true,
    createdAt: new Date().toISOString(),
  };

  store.db
    .query(
      `INSERT INTO subscriptions(id, topic_uri, topic_id, webhook_url, target_address, active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(
      sub.id,
      sub.topicUri,
      sub.topicId ?? null,
      sub.webhookUrl ?? null,
      sub.targetAddress ?? null,
      sub.createdAt,
    );

  return sub;
}

export function listSubscriptions(store: Store): Subscription[] {
  const rows = store.db
    .query(
      `SELECT id, topic_uri, topic_id, webhook_url, target_address, active, created_at, credit
       FROM subscriptions ORDER BY created_at DESC`,
    )
    .all() as Array<{
    id: string;
    topic_uri: string;
    topic_id: number | null;
    webhook_url: string | null;
    target_address: string | null;
    active: number;
    created_at: string;
    credit: string | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    topicUri: r.topic_uri,
    topicId: r.topic_id ?? undefined,
    webhookUrl: r.webhook_url ?? undefined,
    targetAddress: r.target_address ?? undefined,
    active: r.active === 1,
    createdAt: r.created_at,
    credit: r.credit ?? undefined,
  }));
}

export function deactivateSubscription(store: Store, id: string): Subscription | null {
  const sub = listSubscriptions(store).find((s) => s.id === id);
  if (!sub) return null;
  store.db.query("UPDATE subscriptions SET active = 0 WHERE id = ?").run(id);
  return { ...sub, active: false };
}

export function recordEvent(store: Store, event: AttestedEvent): AttestedEvent {
  // `live: true` in the payload marks a genuinely live-sourced attestation
  // (see services/attestation.ts); anything else is recorded as mock-sourced
  // so the audit trail can distinguish them.
  const mock = event.payload?.live === true ? 0 : 1;
  store.db
    .query(
      `INSERT INTO events(id, topic_uri, topic_id, proof_hash, event_commitment, attestation_type, payload_json, verified, mock, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      event.id,
      event.topicUri,
      event.topicId ?? null,
      event.proofHash,
      event.eventCommitment,
      event.attestationType,
      JSON.stringify(event.payload),
      event.verified ? 1 : 0,
      mock,
      event.createdAt,
    );
  return event;
}

/**
 * `before`, when given, is the `id` of an already-seen event (e.g. the last
 * item of a previous page) — pagination walks SQLite's own `rowid`, not
 * `created_at`, since createdAt is only millisecond-precision and a strict
 * `created_at < ?` comparison would silently drop any sibling event recorded
 * in the same millisecond as the cursor.
 */
export function listEvents(
  store: Store,
  limit = 100,
  before?: string,
): AttestedEvent[] {
  const rows = (
    before
      ? store.db
          .query(
            `SELECT id, topic_uri, topic_id, proof_hash, event_commitment, attestation_type, payload_json, verified, mock, created_at
             FROM events WHERE rowid < (SELECT rowid FROM events WHERE id = ?) ORDER BY rowid DESC LIMIT ?`,
          )
          .all(before, limit)
      : store.db
          .query(
            `SELECT id, topic_uri, topic_id, proof_hash, event_commitment, attestation_type, payload_json, verified, mock, created_at
             FROM events ORDER BY rowid DESC LIMIT ?`,
          )
          .all(limit)
  ) as Array<{
    id: string;
    topic_uri: string;
    topic_id: number | null;
    proof_hash: string;
    event_commitment: string;
    attestation_type: string;
    payload_json: string;
    verified: number;
    mock: number;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    topicUri: r.topic_uri,
    topicId: r.topic_id ?? undefined,
    proofHash: r.proof_hash,
    eventCommitment: r.event_commitment,
    attestationType: r.attestation_type as AttestedEvent["attestationType"],
    payload: JSON.parse(r.payload_json) as Record<string, unknown>,
    verified: r.verified === 1,
    createdAt: r.created_at,
  }));
}

export function recordDelivery(
  store: Store,
  delivery: WebhookDelivery,
): WebhookDelivery {
  store.db
    .query(
      `INSERT INTO deliveries(id, subscription_id, event_id, status, attempts, last_error, delivered_at, signature)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      delivery.id,
      delivery.subscriptionId,
      delivery.eventId,
      delivery.status,
      delivery.attempts,
      delivery.lastError ?? null,
      delivery.deliveredAt ?? null,
      delivery.signature ?? null,
    );
  return delivery;
}

export function updateDeliveryStatus(
  store: Store,
  id: string,
  status: DeliveryStatus,
  extra?: Partial<WebhookDelivery>,
): void {
  const current = store.db
    .query(`SELECT * FROM deliveries WHERE id = ?`)
    .get(id) as Record<string, unknown> | null;
  if (!current) return;

  store.db
    .query(
      `UPDATE deliveries SET status = ?, attempts = ?, last_error = ?, delivered_at = ?, signature = ?
       WHERE id = ?`,
    )
    .run(
      status,
      extra?.attempts ?? (current.attempts as number),
      extra?.lastError ?? (current.last_error as string | null),
      extra?.deliveredAt ?? (current.delivered_at as string | null),
      extra?.signature ?? (current.signature as string | null),
      id,
    );
}

export function getDelivery(store: Store, id: string): WebhookDelivery | undefined {
  const r = store.db
    .query(
      `SELECT id, subscription_id, event_id, status, attempts, last_error, delivered_at, signature
       FROM deliveries WHERE id = ?`,
    )
    .get(id) as
    | {
        id: string;
        subscription_id: string;
        event_id: string;
        status: string;
        attempts: number;
        last_error: string | null;
        delivered_at: string | null;
        signature: string | null;
      }
    | null;
  if (!r) return undefined;
  return {
    id: r.id,
    subscriptionId: r.subscription_id,
    eventId: r.event_id,
    status: r.status as WebhookDelivery["status"],
    attempts: r.attempts,
    lastError: r.last_error ?? undefined,
    deliveredAt: r.delivered_at ?? undefined,
    signature: r.signature ?? undefined,
  };
}

export function listDeliveries(store: Store, limit = 100): WebhookDelivery[] {
  const rows = store.db
    .query(
      `SELECT id, subscription_id, event_id, status, attempts, last_error, delivered_at, signature
       FROM deliveries ORDER BY rowid DESC LIMIT ?`,
    )
    .all(limit) as Array<{
    id: string;
    subscription_id: string;
    event_id: string;
    status: string;
    attempts: number;
    last_error: string | null;
    delivered_at: string | null;
    signature: string | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    subscriptionId: r.subscription_id,
    eventId: r.event_id,
    status: r.status as WebhookDelivery["status"],
    attempts: r.attempts,
    lastError: r.last_error ?? undefined,
    deliveredAt: r.delivered_at ?? undefined,
    signature: r.signature ?? undefined,
  }));
}

export function activeSubsForTopic(store: Store, topicUri: string): Subscription[] {
  return listSubscriptions(store).filter(
    (s) => s.active && s.topicUri === topicUri && s.webhookUrl,
  );
}

export interface PaymentWatchCursor {
  topicUri: string;
  lastLedgerIndex: number;
  lastTxHash?: string;
}

export function getWatchCursor(store: Store, topicUri: string): PaymentWatchCursor {
  const row = store.db
    .query("SELECT topic_uri, last_ledger_index, last_tx_hash FROM payment_watch_cursors WHERE topic_uri = ?")
    .get(topicUri) as { topic_uri: string; last_ledger_index: number; last_tx_hash: string | null } | null;
  if (!row) return { topicUri, lastLedgerIndex: 0 };
  return { topicUri: row.topic_uri, lastLedgerIndex: row.last_ledger_index, lastTxHash: row.last_tx_hash ?? undefined };
}

export function setWatchCursor(store: Store, cursor: PaymentWatchCursor): void {
  store.db
    .query(
      `INSERT INTO payment_watch_cursors(topic_uri, last_ledger_index, last_tx_hash, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(topic_uri) DO UPDATE SET
         last_ledger_index = excluded.last_ledger_index,
         last_tx_hash = excluded.last_tx_hash,
         updated_at = excluded.updated_at`,
    )
    .run(cursor.topicUri, cursor.lastLedgerIndex, cursor.lastTxHash ?? null, new Date().toISOString());
}
