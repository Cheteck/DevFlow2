import {
  type Migration,
  type MigrationContext,
  type MigrationProvider,
} from "@mosaix/migrations";

export const IMPERIA_MIGRATION_ID = "imperia.ops.v1.001_create_imperia_tables";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "64987c0f305620ad1db7089648730ff51abb8f9c3c3dd71f2150b38e48a21934";
/* checksum:end */

/**
 * imperia.ops.v1.001_create_imperia_tables — 5 tables for Imperia governance.
 *
 * The schema is declared with the SchemaBuilder DSL: the engine compiles the
 * blueprints with the PostgreSQL grammar and executes the resulting
 * statements.
 *
 * NOTES on column types (PostgresGrammar mapping):
 * - `string` → VARCHAR(255). No `.text()` method exists in TableBuilder.
 *   `dlq.errorMessage` and `settings.value` use `string` (VARCHAR(255)).
 *   For unbounded text, a future migration should ALTER COLUMN TYPE TEXT.
 * - `timestamp` → TIMESTAMP WITH TIME ZONE.
 * - `json` → JSONB.
 * - `enum` → VARCHAR(50) + CHECK constraint (not used here; `status` is `string`).
 *
 * Indexes added for common query patterns:
 * - audit_logs.createdAt (DESC pagination)
 * - audit_logs.(tenantId, createdAt) (tenant-scoped audit queries)
 * - policies.createdAt (policy listing)
 * - dlq.failedAt (DLQ replay ordering)
 *
 * Nullable changes:
 * - circuit_breakers.lastFailureAt nullable (no synthetic date on create).
 *
 * Audit log enhancements:
 * - tenantId, resourceId, severity (default 'info') for multi-tenant audit.
 */
export class ImperiaPostgresMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "imperia";
  }

  migrations(): readonly Migration[] {
    return [
      {
        id: IMPERIA_MIGRATION_ID,
        checksum: MIGRATION_CHECKSUM,
        legacyChecksums: ["bfadfa3886abbf8a"],
        up: (context: MigrationContext) => {
          context.schema.createTable("imperia_audit_logs", (table) => {
            table.string("id").primary();
            table.string("actorId");
            table.string("action");
            table.string("resource");
            table.string("status");
            table.json("metadata").nullable();
            table.timestamp("createdAt");
            table.string("tenantId").nullable();
            table.string("resourceId").nullable();
            table.string("severity").default("info");
            table.index("idx_audit_logs_created_at", ["createdAt"]);
            table.index("idx_audit_logs_tenant_created", [
              "tenantId",
              "createdAt",
            ]);
          });

          context.schema.createTable("imperia_policies", (table) => {
            table.string("id").primary();
            table.string("name");
            table.string("description");
            table.json("rules");
            table.timestamp("createdAt");
            table.timestamp("updatedAt");
            table.index("idx_policies_created_at", ["createdAt"]);
          });

          context.schema.createTable("imperia_dlq", (table) => {
            table.string("id").primary();
            table.string("topic");
            table.json("payload").nullable();
            table.string("errorMessage");
            table.timestamp("failedAt");
            table.index("idx_dlq_failed_at", ["failedAt"]);
          });

          context.schema.createTable("imperia_circuit_breakers", (table) => {
            table.string("name").primary();
            table.string("state");
            table.integer("failures");
            table.timestamp("lastFailureAt").nullable();
          });

          context.schema.createTable("imperia_settings", (table) => {
            table.string("key").primary();
            table.string("value");
            table.timestamp("updatedAt");
          });
        },
        downMigration: (context: MigrationContext) => {
          context.schema.dropTable("imperia_settings");
          context.schema.dropTable("imperia_circuit_breakers");
          context.schema.dropTable("imperia_dlq");
          context.schema.dropTable("imperia_policies");
          context.schema.dropTable("imperia_audit_logs");
        },
        resources: [
          "table:imperia_audit_logs",
          "table:imperia_policies",
          "table:imperia_dlq",
          "table:imperia_circuit_breakers",
          "table:imperia_settings",
        ],
      },
    ];
  }
}
