import {
  SchemaBuilder,
  PostgresGrammar,
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

export class CitadellePostgresMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "citadelle";
  }

  migrations(): readonly Migration[] {
    const builder = new SchemaBuilder();
    const grammar = new PostgresGrammar();

    // 1. Identities
    builder.createTable("citadelle_identities", (table) => {
      table.string("id").primary();
      table.string("tenant_id");
      table.string("email");
      table.string("status").default("active");
      table.string("display_name").nullable();
      table.json("roles").nullable();
      table.string("mfa_secret").nullable();
      table.json("metadata").nullable();
      table.timestamp("created_at");
      table.timestamp("updated_at");
      table.unique("uniq_citadelle_email", ["email"]);
      table.index("idx_identities_email", ["email"]);
      table.index("idx_identities_tenant", ["tenant_id"]);
    });

    // 2. Credentials
    builder.createTable("citadelle_credentials", (table) => {
      table.string("id").primary();
      table.string("identity_id");
      table.string("type");
      table.json("data");
      table.timestamp("created_at");
      table.foreignKey("identity_id", "citadelle_identities", "id");
      table.index("idx_credentials_identity", ["identity_id"]);
    });

    // 3. Sessions
    builder.createTable("citadelle_sessions", (table) => {
      table.string("id").primary();
      table.string("identity_id");
      table.timestamp("expires_at");
      table.json("data").nullable();
      table.foreignKey("identity_id", "citadelle_identities", "id");
      table.index("idx_sessions_identity", ["identity_id"]);
      table.index("idx_sessions_expires", ["expires_at"]);
    });

    const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));
    const sqlContent = statements.map((s) => s.sql).join("\n");

    const downStatements = [
      { type: "dropTable" as const, table: "citadelle_sessions" },
      { type: "dropTable" as const, table: "citadelle_credentials" },
      { type: "dropTable" as const, table: "citadelle_identities" },
    ].flatMap((bp) => grammar.compile(bp));
    const downContent = downStatements.map((s) => s.sql).join("\n");

    const migrationId = "citadelle.v1.001_create_auth_tables";

    return [
      {
        id: migrationId,
        content: sqlContent,
        down: downContent,
        checksum: computeChecksum(sqlContent),
        resources: [
          "table:citadelle_identities",
          "table:citadelle_credentials",
          "table:citadelle_sessions",
        ],
      },
    ];
  }
}
