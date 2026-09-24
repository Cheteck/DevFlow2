import {
  SchemaBuilder,
  PostgresGrammar,
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

export class BookingPostgresMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "booking";
  }

  migrations(): readonly Migration[] {
    const builder = new SchemaBuilder();
    const grammar = new PostgresGrammar();

    builder.createTable("booking_slots", (table) => {
      table.string("id").primary();
      table.string("providerId");
      table.enum("status", ["Available", "Reserved", "Cancelled", "Completed"]);
      table.json("data");
      table.timestamp("createdAt").nullable();
      table.timestamp("updatedAt").nullable();
      table.index("idx_booking_slots_provider", ["providerId"]);
      table.index("idx_booking_slots_status", ["status"]);
    });

    builder.createTable("booking_reservations", (table) => {
      table.string("id").primary();
      table.string("slotId");
      table.string("customerId");
      table.enum("status", ["Pending", "Confirmed", "Cancelled", "Expired"]);
      table.json("data");
      table.timestamp("createdAt").nullable();
      table.timestamp("updatedAt").nullable();
      table.foreignKey("slotId", "booking_slots", "id");
      table.index("idx_reservations_slot", ["slotId"]);
      table.index("idx_reservations_customer", ["customerId"]);
      table.index("idx_reservations_status", ["status"]);
    });

    const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));
    const sqlContent = statements.map((s) => s.sql).join("\n");

    const downStatements = [
      { type: "dropTable" as const, table: "booking_reservations" },
      { type: "dropTable" as const, table: "booking_slots" },
    ].flatMap((bp) => grammar.compile(bp));
    const downContent = downStatements.map((s) => s.sql).join("\n");

    const migrationId = "booking.v1.001_create_booking_tables";

    return [
      {
        id: migrationId,
        content: sqlContent,
        down: downContent,
        checksum: computeChecksum(sqlContent),
        resources: [
          "table:booking_slots",
          "table:booking_reservations",
        ],
      },
    ];
  }
}
