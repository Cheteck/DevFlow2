import {
  type Migration,
  type MigrationContext,
  type MigrationProvider,
} from "@mosaix/migrations";

export const SOLIDARITY_MIGRATION_ID =
  "solidarity.relief.v1.001_create_solidarity_tables";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "1a4601e20c9e8980132efd02b42ac0327feaeb26c220f011004433ea1c8076f5";
/* checksum:end */

/**
 * @apps/solidarity — Postgres migration manifest (Phase-0 BAC wiring).
 *
 * The migration declares its schema with the SchemaBuilder DSL: the engine
 * compiles the blueprints with the PostgreSQL grammar and executes the
 * resulting statements.
 *
 * The historical checksum is kept in `legacyChecksums` so that databases
 * where this migration is already applied are not rejected by the Planner.
 */
export class SolidarityPostgresMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "solidarity";
  }

  migrations(): readonly Migration[] {
    return [
      {
        id: SOLIDARITY_MIGRATION_ID,
        checksum: MIGRATION_CHECKSUM,
        legacyChecksums: ["e097b29c5ec26edb"],
        up: (context: MigrationContext) => {
          context.schema.createTable("solidarity_incidents", (table) => {
            table.string("id").primary();
            table.string("code");
            table.string("type");
            table.string("status");
            table.string("severityLevel");
            table.string("geoZone");
            table.string("coordinatingOrgId");
            table.json("data");
            table.index("idx_incidents_status", ["status"]);
            table.index("idx_incidents_zone", ["geoZone"]);
          });

          context.schema.createTable("solidarity_needs", (table) => {
            table.string("id").primary();
            table.string("incidentId");
            table.string("type");
            table.string("urgency");
            table.string("status");
            table.integer("quantitySatisfied").default(0);
            table.json("data");
            table.index("idx_needs_incident", ["incidentId"]);
            table.index("idx_needs_status", ["status"]);
            table.foreignKey("incidentId", "solidarity_incidents", "id");
          });

          context.schema.createTable("solidarity_donations", (table) => {
            table.string("id").primary();
            table.string("donorId");
            table.string("itemType");
            table.integer("quantity");
            table.string("verificationStatus");
            table.json("data");
            table.index("idx_donations_donor", ["donorId"]);
            table.index("idx_donations_status", ["verificationStatus"]);
          });

          context.schema.createTable("solidarity_hubs", (table) => {
            table.string("id").primary();
            table.string("spaceId");
            table.string("name");
            table.string("type");
            table.string("geoZone");
            table.json("data");
            table.index("idx_hubs_zone", ["geoZone"]);
          });

          context.schema.createTable("solidarity_resources", (table) => {
            table.string("id").primary();
            table.string("donationId").nullable();
            table.string("ownerId");
            table.string("type");
            table.integer("totalQuantity");
            table.integer("availableQuantity");
            table.string("hubId");
            table.string("status");
            table.json("data");
            table.foreignKey("hubId", "solidarity_hubs", "id");
            table.foreignKey("donationId", "solidarity_donations", "id");
            table.index("idx_resources_hub", ["hubId"]);
          });

          context.schema.createTable("solidarity_missions", (table) => {
            table.string("id").primary();
            table.string("originHubId");
            table.string("status");
            table.json("data");
            table.foreignKey("originHubId", "solidarity_hubs", "id");
            table.index("idx_missions_status", ["status"]);
          });

          context.schema.createTable("solidarity_distributions", (table) => {
            table.string("id").primary();
            table.string("missionId");
            table.string("hubId");
            table.integer("beneficiaryCount");
            table.json("data");
            table.foreignKey("missionId", "solidarity_missions", "id");
            table.foreignKey("hubId", "solidarity_hubs", "id");
            table.index("idx_distributions_mission", ["missionId"]);
            table.index("idx_distributions_hub", ["hubId"]);
          });
        },
        downMigration: (context: MigrationContext) => {
          context.schema.dropTable("solidarity_distributions");
          context.schema.dropTable("solidarity_missions");
          context.schema.dropTable("solidarity_resources");
          context.schema.dropTable("solidarity_hubs");
          context.schema.dropTable("solidarity_donations");
          context.schema.dropTable("solidarity_needs");
          context.schema.dropTable("solidarity_incidents");
        },
        resources: [
          "table:solidarity_incidents",
          "table:solidarity_needs",
          "table:solidarity_donations",
          "table:solidarity_hubs",
          "table:solidarity_resources",
          "table:solidarity_missions",
          "table:solidarity_distributions",
        ],
      },
    ];
  }
}
