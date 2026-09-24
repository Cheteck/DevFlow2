import {
  SchemaBuilder,
  PostgresGrammar,
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

export class SolidarityPostgresMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "solidarity";
  }

  migrations(): readonly Migration[] {
    const builder = new SchemaBuilder();
    const grammar = new PostgresGrammar();

    builder.createTable("solidarity_incidents", (table) => {
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

    builder.createTable("solidarity_needs", (table) => {
      table.string("id").primary();
      table.string("incidentId");
      table.string("type");
      table.string("urgency");
      table.string("status");
      table.integer("quantitySatisfied").default(0);
      table.json("data");
      table.index("idx_needs_incident", ["incidentId"]);
      table.index("idx_needs_status", ["status"]);
    });

    builder.createTable("solidarity_donations", (table) => {
      table.string("id").primary();
      table.string("donorId");
      table.string("itemType");
      table.integer("quantity");
      table.string("verificationStatus");
      table.json("data");
      table.index("idx_donations_donor", ["donorId"]);
      table.index("idx_donations_status", ["verificationStatus"]);
    });

    builder.createTable("solidarity_hubs", (table) => {
      table.string("id").primary();
      table.string("spaceId");
      table.string("name");
      table.string("type");
      table.string("geoZone");
      table.json("data");
      table.index("idx_hubs_zone", ["geoZone"]);
    });

    builder.createTable("solidarity_resources", (table) => {
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
      table.index("idx_resources_hub", ["hubId"]);
    });

    builder.createTable("solidarity_missions", (table) => {
      table.string("id").primary();
      table.string("originHubId");
      table.string("status");
      table.json("data");
      table.foreignKey("originHubId", "solidarity_hubs", "id");
      table.index("idx_missions_status", ["status"]);
    });

    builder.createTable("solidarity_distributions", (table) => {
      table.string("id").primary();
      table.string("missionId");
      table.string("hubId");
      table.integer("beneficiaryCount");
      table.json("data");
      table.foreignKey("missionId", "solidarity_missions", "id");
      table.foreignKey("hubId", "solidarity_hubs", "id");
    });

    const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));
    const sqlContent = statements.map((s) => s.sql).join("\n");

    const downStatements = [
      { type: "dropTable" as const, table: "solidarity_distributions" },
      { type: "dropTable" as const, table: "solidarity_missions" },
      { type: "dropTable" as const, table: "solidarity_resources" },
      { type: "dropTable" as const, table: "solidarity_hubs" },
      { type: "dropTable" as const, table: "solidarity_donations" },
      { type: "dropTable" as const, table: "solidarity_needs" },
      { type: "dropTable" as const, table: "solidarity_incidents" },
    ].flatMap((bp) => grammar.compile(bp));
    const downContent = downStatements.map((s) => s.sql).join("\n");

    const migrationId = "solidarity.v1.001_create_solidarity_tables";

    return [
      {
        id: migrationId,
        content: sqlContent,
        down: downContent,
        checksum: computeChecksum(sqlContent),
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
