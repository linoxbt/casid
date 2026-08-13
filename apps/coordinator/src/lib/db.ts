import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

export type Db = Database;

// Coordinator package root, independent of process.cwd().
const PACKAGE_ROOT = join(import.meta.dir, "../..");

const DEFAULT_PATH = "./data/casid.db";

/**
 * Any relative path — whether explicitly passed in, from DATABASE_PATH, or
 * the default — is resolved against the coordinator package root rather than
 * process.cwd(). A caller passing an already-relative path (as index.ts's own
 * `process.env.DATABASE_PATH ?? "./data/casid.db"` does) would otherwise
 * still be cwd-dependent, silently defeating this fix; resolving here,
 * unconditionally, is what actually makes the path stable regardless of
 * launch directory.
 */
export function openDb(path: string = DEFAULT_PATH): Db {
  const resolved = isAbsolute(path) ? path : join(PACKAGE_ROOT, path);
  mkdirSync(dirname(resolved), { recursive: true });
  const db = new Database(resolved, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      on_chain_id INTEGER,
      uri TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      schema_hash_input TEXT,
      created_at TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      topic_uri TEXT NOT NULL,
      topic_id INTEGER,
      webhook_url TEXT,
      target_address TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      credit TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      topic_uri TEXT NOT NULL,
      topic_id INTEGER,
      proof_hash TEXT NOT NULL,
      event_commitment TEXT NOT NULL,
      attestation_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      mock INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      subscription_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      delivered_at TEXT,
      signature TEXT
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_watch_cursors (
      topic_uri TEXT PRIMARY KEY,
      last_ledger_index INTEGER NOT NULL DEFAULT 0,
      last_tx_hash TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_subs_topic ON subscriptions(topic_uri);
  `);

  // Databases created before `created_by` existed on `topics` need it added
  // in place — CREATE TABLE IF NOT EXISTS above is a no-op against them.
  const topicColumns = db.query("PRAGMA table_info(topics)").all() as { name: string }[];
  if (!topicColumns.some((c) => c.name === "created_by")) {
    db.exec("ALTER TABLE topics ADD COLUMN created_by TEXT;");
  }
}

export function getMeta(db: Db, key: string): string | null {
  const row = db.query("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | null;
  return row?.value ?? null;
}

export function setMeta(db: Db, key: string, value: string): void {
  db.query(
    "INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}
