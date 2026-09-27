/**
 * @shell/database — Mobile Bridge migration provider.
 *
 * Owns the mobile bridge tables (OAuth PKCE auth codes, device registry,
 * refresh tokens) as versioned migrations executed **only from the CLI**
 * (`mosaix migrate`), tracked in the `mosaix_migrations` ledger.
 */
import {
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

export const MOBILE_BRIDGE_MIGRATION_ID = "shell.mobile.v1.001_create_mobile_bridge_tables";

const UP = `
CREATE TABLE IF NOT EXISTS oauth_auth_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_user ON oauth_auth_codes (user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_expires ON oauth_auth_codes (expires_at);

CREATE TABLE IF NOT EXISTS mobile_devices (
  device_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  fcm_token TEXT NOT NULL,
  platform TEXT NOT NULL,
  app_version TEXT,
  os_version TEXT,
  device_model TEXT,
  subscribed_topics TEXT,
  registered_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mobile_devices_user ON mobile_devices (user_id);

CREATE TABLE IF NOT EXISTS refresh_token_sessions (
  session_id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  current_refresh_token TEXT NOT NULL,
  previous_refresh_tokens TEXT,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  is_revoked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_token_sessions_user ON refresh_token_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_token_sessions_family ON refresh_token_sessions (family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_token_sessions_token ON refresh_token_sessions (current_refresh_token);
`;

const DOWN = `
DROP TABLE IF EXISTS refresh_token_sessions;
DROP TABLE IF EXISTS mobile_devices;
DROP TABLE IF EXISTS oauth_auth_codes;
`;

export class MobileBridgeMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "shell";
  }

  migrations(): readonly Migration[] {
    return [
      {
        id: MOBILE_BRIDGE_MIGRATION_ID,
        content: UP,
        down: DOWN,
        checksum: computeChecksum(UP),
        resources: [
          "table:oauth_auth_codes",
          "table:mobile_devices",
          "table:refresh_token_sessions",
        ],
      },
    ];
  }
}