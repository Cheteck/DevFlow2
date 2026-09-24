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

    // 1. Booking Slots
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

    // 2. Reservations
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

    // 3. Waitlists
    builder.createTable("booking_waitlists", (table) => {
      table.string("id").primary();
      table.string("slotId");
      table.string("customerId");
      table.string("customerEmail");
      table.integer("position").default(1);
      table.enum("status", ["Active", "Notified", "Promoted", "Cancelled"]);
      table.timestamp("createdAt");
      table.foreignKey("slotId", "booking_slots", "id");
      table.index("idx_waitlists_slot", ["slotId"]);
    });

    // 4. Reminders
    builder.createTable("booking_reminders", (table) => {
      table.string("id").primary();
      table.string("reservationId");
      table.string("customerId");
      table.timestamp("sendAt");
      table.enum("status", ["Scheduled", "Sent", "Failed", "Cancelled"]);
      table.timestamp("createdAt");
      table.foreignKey("reservationId", "booking_reservations", "id");
      table.index("idx_reminders_reservation", ["reservationId"]);
      table.index("idx_reminders_status_send", ["status", "sendAt"]);
    });

    const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));
    const sqlContent = statements.map((s) => s.sql).join("\n");

    const downStatements = [
      { type: "dropTable" as const, table: "booking_reminders" },
      { type: "dropTable" as const, table: "booking_waitlists" },
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
          "table:booking_waitlists",
          "table:booking_reminders",
        ],
      },
    ];
  }
}
