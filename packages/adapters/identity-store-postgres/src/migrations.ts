import {
  SchemaBuilder,
  PostgresGrammar,
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

export class AuthPostgresMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "identity.auth";
  }

  migrations(): readonly Migration[] {
    const builder = new SchemaBuilder();
    const grammar = new PostgresGrammar();

    builder.createTable("identities", (table) => {
      table.string("id").primary();
      table.string("tenant_id");
      table.string("email");
      table.string("status").default("active");
      table.string("display_name").nullable();
      table.json("metadata").nullable();
      table.timestamp("created_at");
      table.timestamp("updated_at");
      table.index("idx_identities_tenant_email", ["tenant_id", "email"]);
    });

    builder.createTable("credentials", (table) => {
      table.string("id").primary();
      table.string("identity_id");
      table.string("type");
      table.json("data");
      table.timestamp("created_at");
      table.timestamp("updated_at");
      table.foreignKey("identity_id", "identities", "id");
      table.unique("uniq_credentials_identity_type", ["identity_id", "type"]);
    });

    builder.createTable("tokens", (table) => {
      table.string("id").primary();
      table.string("identity_id");
      table.string("type");
      table.string("token_hash");
      table.timestamp("expires_at");
      table.timestamp("consumed_at").nullable();
      table.timestamp("created_at");
      table.foreignKey("identity_id", "identities", "id");
      table.index("idx_tokens_hash", ["token_hash"]);
      table.index("idx_tokens_identity", ["identity_id"]);
    });

    builder.createTable("external_identities", (table) => {
      table.string("id").primary();
      table.string("identity_id");
      table.string("provider");
      table.string("external_id");
      table.json("metadata").nullable();
      table.timestamp("created_at");
      table.foreignKey("identity_id", "identities", "id");
      table.unique("uniq_external_identities_provider_id", ["provider", "external_id"]);
    });

    const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));
    const sqlContent = statements.map((s) => s.sql).join("\n");

    const downStatements = [
      { type: "dropTable" as const, table: "external_identities" },
      { type: "dropTable" as const, table: "tokens" },
      { type: "dropTable" as const, table: "credentials" },
      { type: "dropTable" as const, table: "identities" },
    ].flatMap((bp) => grammar.compile(bp));
    const downContent = downStatements.map((s) => s.sql).join("\n");

    const migrationId = "identity.auth.v1.001_create_auth_tables";

    return [
      {
        id: migrationId,
        content: sqlContent,
        down: downContent,
        checksum: computeChecksum(sqlContent),
        resources: [
          "table:identities",
          "table:credentials",
          "table:tokens",
          "table:external_identities",
        ],
      },
    ];
  }
}
