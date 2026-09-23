import { SQLiteDatabaseAdapter } from "@mosaix/adapter-database-sqlite";
import { SQLiteIdentityStoreAdapter } from "@mosaix/adapter-identity-store-sqlite";
import * as path from "node:path";
import * as fs from "node:fs";

export interface DatabaseBootstrapResult {
  dbAdapter: SQLiteDatabaseAdapter;
  identityStore: SQLiteIdentityStoreAdapter;
}

export function initDatabase(): DatabaseBootstrapResult {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "mosaix.sqlite");
  const dbAdapter = new SQLiteDatabaseAdapter(dbPath);
  const identityStore = new SQLiteIdentityStoreAdapter(dbAdapter);

  // High-performance WAL mode and write concurrency optimizations
  dbAdapter.execute(`PRAGMA journal_mode = WAL;`).catch(() => {});
  dbAdapter.execute(`PRAGMA synchronous = NORMAL;`).catch(() => {});
  dbAdapter.execute(`PRAGMA busy_timeout = 5000;`).catch(() => {});
  dbAdapter.execute(`PRAGMA foreign_keys = ON;`).catch(() => {});

  // Safe incremental migrations for existing tables
  dbAdapter.execute(`
    CREATE TABLE IF NOT EXISTS identities (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      email TEXT UNIQUE,
      display_name TEXT,
      status TEXT,
      created_at TEXT,
      updated_at TEXT,
      attributes TEXT
    );
  `).then(() => {
    // Migrate missing columns on identities if pre-existing
    dbAdapter.execute(`ALTER TABLE identities ADD COLUMN display_name TEXT;`).catch(() => {});
    dbAdapter.execute(`ALTER TABLE identities ADD COLUMN tenant_id TEXT;`).catch(() => {});
    dbAdapter.execute(`ALTER TABLE identities ADD COLUMN status TEXT;`).catch(() => {});
    dbAdapter.execute(`ALTER TABLE identities ADD COLUMN created_at TEXT;`).catch(() => {});
    dbAdapter.execute(`ALTER TABLE identities ADD COLUMN updated_at TEXT;`).catch(() => {});
    dbAdapter.execute(`ALTER TABLE identities ADD COLUMN attributes TEXT;`).catch(() => {});

    // Create related auth/session tables
    dbAdapter.execute(`
      CREATE TABLE IF NOT EXISTS external_identities (
        identity_id TEXT,
        provider TEXT,
        external_id TEXT,
        linked_at TEXT,
        attributes TEXT,
        PRIMARY KEY (identity_id, provider, external_id)
      );

      CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,
        identity_id TEXT,
        type TEXT,
        created_at TEXT,
        updated_at TEXT,
        expires_at TEXT,
        revoked_at TEXT,
        data TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        identity_id TEXT,
        tenant_id TEXT,
        application_id TEXT,
        created_at TEXT,
        expires_at TEXT,
        revoked_at TEXT,
        attributes TEXT
      );

      CREATE TABLE IF NOT EXISTS tokens (
        token_id TEXT PRIMARY KEY,
        identity_id TEXT,
        session_id TEXT,
        type TEXT,
        expires_at TEXT,
        revoked_at TEXT,
        attributes TEXT
      );

      CREATE TABLE IF NOT EXISTS shell_feed (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        author TEXT NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        category TEXT,
        tags TEXT,
        likes INTEGER DEFAULT 0,
        timestamp INTEGER NOT NULL,
        space_id TEXT
      );
    `).then(() => {
      // Migrate missing columns on shell_feed
      dbAdapter.execute(`ALTER TABLE shell_feed ADD COLUMN category TEXT;`).catch(() => {});
      dbAdapter.execute(`ALTER TABLE shell_feed ADD COLUMN tags TEXT;`).catch(() => {});
      dbAdapter.execute(`ALTER TABLE shell_feed ADD COLUMN space_id TEXT;`).catch(() => {});
      dbAdapter.execute(`ALTER TABLE shell_feed ADD COLUMN title TEXT;`).catch(() => {});

      // Indices
      dbAdapter.execute(`CREATE INDEX IF NOT EXISTS idx_shell_feed_timestamp ON shell_feed (timestamp DESC);`).catch(() => {});
      dbAdapter.execute(`CREATE INDEX IF NOT EXISTS idx_shell_feed_category ON shell_feed (category);`).catch(() => {});
      dbAdapter.execute(`CREATE INDEX IF NOT EXISTS idx_identities_email ON identities (email);`).catch(() => {});
    }).catch(() => {});
  }).catch((err) => {
    console.error("[database-bootstrap] Schema init error:", err);
  });

  return { dbAdapter, identityStore };
}
