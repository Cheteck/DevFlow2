/**
 * @shell/database — Minimal core migration provider for fresh Postgres DB.
 * Only creates tables that are truly shell-owned (not claimed by any BAC).
 * Used temporarily until DB-BAC-OWNERSHIP moves tables out of shell.core.v1.001.
 */
import {
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

export const MINIMAL_CORE_MIGRATION_ID = "shell.core.v1.003_minimal_core_tables";

const UP = `
-- Shell-owned tables only (not claimed by BACs)
CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT DEFAULT 'default',
  email TEXT UNIQUE,
  display_name TEXT,
  status TEXT DEFAULT 'active',
  password_hash TEXT,
  roles TEXT DEFAULT '["member"]',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  attributes TEXT
);

CREATE TABLE IF NOT EXISTS external_identities (
  identity_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  linked_at TEXT NOT NULL,
  attributes TEXT,
  PRIMARY KEY (identity_id, provider, external_id)
);

CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  expires_at TEXT,
  revoked_at TEXT,
  data TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  tenant_id TEXT DEFAULT 'default',
  application_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  attributes TEXT
);

CREATE TABLE IF NOT EXISTS tokens (
  token_id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  session_id TEXT,
  type TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  attributes TEXT
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_id TEXT,
  status TEXT,
  current_period_start INTEGER,
  current_period_end INTEGER,
  cancel_at_period_end INTEGER,
  metered_usage_units INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS shell_feed (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'post',
  author TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  tags TEXT,
  likes INTEGER DEFAULT 0,
  timestamp INTEGER NOT NULL,
  space_id TEXT
);

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_identities_email ON identities (email);
CREATE INDEX IF NOT EXISTS idx_identities_tenant ON identities (tenant_id);
CREATE INDEX IF NOT EXISTS idx_shell_feed_timestamp ON shell_feed (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_shell_feed_category ON shell_feed (category);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions (status);
`;

const DOWN = `
DROP TABLE IF EXISTS platform_settings;
DROP TABLE IF EXISTS shell_feed;
DROP TABLE IF EXISTS user_subscriptions;
DROP TABLE IF EXISTS tokens;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS credentials;
DROP TABLE IF EXISTS external_identities;
DROP TABLE IF EXISTS identities;
`;

export class MinimalCoreMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "shell";
  }

  migrations(): readonly Migration[] {
    return [
      {
        id: MINIMAL_CORE_MIGRATION_ID,
        content: UP,
        down: DOWN,
        checksum: computeChecksum(UP),
        resources: [
          "table:identities",
          "table:external_identities",
          "table:credentials",
          "table:sessions",
          "table:tokens",
          "table:user_subscriptions",
          "table:shell_feed",
          "table:platform_settings",
        ],
      },
    ];
  }
}