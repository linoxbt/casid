import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export type Db = Database;

// Resolve relative to the coordinator package root (not process.cwd()), so the
// same database file is used whether the process is started from the repo
// root or from apps/coordinator/ — cwd-relative paths previously caused two
// independent SQLite files to exist depending on launch directory.
const DEFAULT_PATH =
  process.env.DATABASE_PATH ?? join(import.meta.dir, "../../data/casid.db");

export function openDb(path = DEFAULT_PATH): Db {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true });
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
      active INTEGER NOT NULL DEFAULT 1
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

    CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_subs_topic ON subscriptions(topic_uri);
  `);
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
