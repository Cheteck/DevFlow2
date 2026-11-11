import {
  type Migration,
  type MigrationContext,
  type MigrationProvider,
} from "@mosaix/migrations";

export const IDENTITY_MIGRATION_ID = "identity.auth.v1.001_create_auth_tables";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "9673865a7d5bb77b870d658b81719e00e621fa000d358a1278208faccdc4ac63";
/* checksum:end */

/**
 * @mosaix/adapter-identity-store-postgres — identity tables migration.
 *
 * The schema is declared with the SchemaBuilder DSL: the engine compiles the
 * blueprints with the PostgreSQL grammar and executes the resulting
 * statements.
 */
export class AuthPostgresMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "identity.auth";
  }

  migrations(): readonly Migration[] {
    return [
      {
        id: IDENTITY_MIGRATION_ID,
        checksum: MIGRATION_CHECKSUM,
        up: (context: MigrationContext) => {
          context.schema.createTable("identities", (table) => {
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

          context.schema.createTable("credentials", (table) => {
            table.string("id").primary();
            table.string("identity_id");
            table.string("type");
            table.json("data");
            table.timestamp("created_at");
            table.timestamp("updated_at");
            table.foreignKey("identity_id", "identities", "id");
            table.unique("uniq_credentials_identity_type", [
              "identity_id",
              "type",
            ]);
          });

          context.schema.createTable("tokens", (table) => {
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

          context.schema.createTable("external_identities", (table) => {
            table.string("id").primary();
            table.string("identity_id");
            table.string("provider");
            table.string("external_id");
            table.json("metadata").nullable();
            table.timestamp("created_at");
            table.foreignKey("identity_id", "identities", "id");
            table.unique("uniq_external_identities_provider_id", [
              "provider",
              "external_id",
            ]);
          });
        },
        downMigration: (context: MigrationContext) => {
          context.schema.dropTable("external_identities");
          context.schema.dropTable("tokens");
          context.schema.dropTable("credentials");
          context.schema.dropTable("identities");
        },
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
