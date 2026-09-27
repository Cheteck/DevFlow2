/**
 * @shell/database — Feature Flags migration provider.
 *
 * Owns the feature_flags table for persistent feature flag storage.
 */
import {
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

export const FEATURE_FLAGS_MIGRATION_ID = "shell.features.v1.001_create_feature_flags_table";

const UP = `
CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  variation_type TEXT DEFAULT 'boolean',
  roles_allowlist TEXT,
  users_allowlist TEXT,
  tenants_allowlist TEXT,
  plans_allowlist TEXT,
  percentage_rollout INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_category ON feature_flags (category);
`;

const DOWN = `
DROP TABLE IF EXISTS feature_flags;
`;

export class FeatureFlagsMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "shell";
  }

  migrations(): readonly Migration[] {
    return [
      {
        id: FEATURE_FLAGS_MIGRATION_ID,
        content: UP,
        down: DOWN,
        checksum: computeChecksum(UP),
        resources: ["table:feature_flags"],
      },
    ];
  }
}