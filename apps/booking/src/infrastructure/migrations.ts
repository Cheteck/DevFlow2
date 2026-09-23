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
      table.string("serviceName");
      table.timestamp("startTime");
      table.timestamp("endTime");
      table.string("timezone");
      table.integer("capacity");
      table.integer("reservedCount");
      table.string("status");
      table.string("location").nullable();
      table.decimal("price").nullable();
      table.string("currency").nullable();
      table.timestamp("createdAt");
    });

    builder.createTable("reservations", (table) => {
      table.string("id").primary();
      table.string("slotId");
      table.string("customerId");
      table.string("customerName");
      table.string("customerEmail");
      table.string("status");
      table.timestamp("holdExpiresAt").nullable();
      table.timestamp("createdAt");
      table.foreignKey("slotId", "booking_slots", "id");
    });

    const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));
    const sqlContent = statements.map((s) => s.sql).join("\n");

    const downStatements = [
      { type: "dropTable" as const, table: "reservations" },
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
          "table:reservations",
        ],
      },
    ];
  }
}
