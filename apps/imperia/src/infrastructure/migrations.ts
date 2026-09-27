import {
  SchemaBuilder,
  PostgresGrammar,
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

/**
 * imperia.v1.001_create_imperia_tables — 5 tables for Imperia governance.
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
    const builder = new SchemaBuilder();
    const grammar = new PostgresGrammar();

    builder.createTable("imperia_audit_logs", (table) => {
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
      table.index("idx_audit_logs_tenant_created", ["tenantId", "createdAt"]);
    });

    builder.createTable("imperia_policies", (table) => {
      table.string("id").primary();
      table.string("name");
      table.string("description");
      table.json("rules");
      table.timestamp("createdAt");
      table.timestamp("updatedAt");
      table.index("idx_policies_created_at", ["createdAt"]);
    });

    builder.createTable("imperia_dlq", (table) => {
      table.string("id").primary();
      table.string("topic");
      table.json("payload").nullable();
      table.string("errorMessage");
      table.timestamp("failedAt");
      table.index("idx_dlq_failed_at", ["failedAt"]);
    });

    builder.createTable("imperia_circuit_breakers", (table) => {
      table.string("name").primary();
      table.string("state");
      table.integer("failures");
      table.timestamp("lastFailureAt").nullable();
    });

    builder.createTable("imperia_settings", (table) => {
      table.string("key").primary();
      table.string("value");
      table.timestamp("updatedAt");
    });

    const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));
    const sqlContent = statements.map((s) => s.sql).join("\n");

    const downStatements = [
      { type: "dropTable" as const, table: "imperia_settings" },
      { type: "dropTable" as const, table: "imperia_circuit_breakers" },
      { type: "dropTable" as const, table: "imperia_dlq" },
      { type: "dropTable" as const, table: "imperia_policies" },
      { type: "dropTable" as const, table: "imperia_audit_logs" },
    ].flatMap((bp) => grammar.compile(bp));
    const downContent = downStatements.map((s) => s.sql).join("\n");

    const migrationId = "imperia.v1.001_create_imperia_tables";

    return [
      {
        id: migrationId,
        content: sqlContent,
        down: downContent,
        checksum: computeChecksum(sqlContent),
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
