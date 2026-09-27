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

    // 1. Booking Slots — ENUM aligné sur le domaine réellement écrit par le
    // repo (`PostgresBookingRepository.saveSlot` persiste `slot.status` tel
    // quel) : BookingSlotStatus = available|fully_booked|cancelled|held
    // (booking.model.ts:14). Les valeurs DDL historiques
    // (Available|Reserved|Cancelled|Completed) n'étaient jamais écrites.
    builder.createTable("booking_slots", (table) => {
      table.string("id").primary();
      table.string("providerId");
      table.enum("status", ["available", "fully_booked", "cancelled", "held"]);
      table.json("data");
      table.timestamp("createdAt").nullable();
      table.timestamp("updatedAt").nullable();
      table.index("idx_booking_slots_provider", ["providerId"]);
      table.index("idx_booking_slots_status", ["status"]);
    });

    // 2. Reservations — ENUM aligné sur BookingStatus (booking.model.ts:2-12,
    // 10 statuts écrits par `saveReservation`). Colonne `idempotencyKey`
    // NULLABLE + UNIQUE (table.unique) : les réservations sans clé restent
    // possibles (NULL multiples autorisés en Postgres), les doublons de clé
    // sont rejetés. Le repo fait un lookup avant create (support minimal).
    builder.createTable("booking_reservations", (table) => {
      table.string("id").primary();
      table.string("slotId");
      table.string("customerId");
      table.enum("status", [
        "draft",
        "pending",
        "held",
        "confirmed",
        "checked_in",
        "completed",
        "cancelled",
        "rejected",
        "no_show",
        "expired",
      ]);
      table.string("idempotencyKey").nullable();
      table.json("data");
      table.timestamp("createdAt").nullable();
      table.timestamp("updatedAt").nullable();
      table.foreignKey("slotId", "booking_slots", "id");
      table.unique("uniq_booking_reservations_idempotency", ["idempotencyKey"]);
      table.index("idx_reservations_slot", ["slotId"]);
      table.index("idx_reservations_customer", ["customerId"]);
      table.index("idx_reservations_status", ["status"]);
    });

    // 3. Waitlists — ENUM aligné sur WaitlistEntry.status
    // (booking-calendar-sync.ts:88-96) : waiting|promoted|expired, valeurs
    // écrites par `saveWaitlistEntry`. `createdAt` NULLABLE (et non
    // `DEFAULT now()`) : PostgresGrammar.quote les defaults string
    // (`DEFAULT 'now()'` invalide) — la grammaire ne supporte pas les
    // expressions SQL brutes ; le repo renseigne createdAt côté applicatif.
    // Colonne `data` (JSONB, nullable) : payload complet (customerName,
    // joinedAt), même pattern que slots/réservations.
    builder.createTable("booking_waitlists", (table) => {
      table.string("id").primary();
      table.string("slotId");
      table.string("customerId");
      table.string("customerEmail");
      table.integer("position").default(1);
      table.enum("status", ["waiting", "promoted", "expired"]);
      table.timestamp("createdAt").nullable();
      table.json("data").nullable();
      table.foreignKey("slotId", "booking_slots", "id");
      table.index("idx_waitlists_slot", ["slotId"]);
    });

    // 4. Reminders — `createdAt` NULLABLE pour la même raison grammaire que
    // waitlists (pas de DEFAULT now() via builder). Colonne `data` (JSONB,
    // nullable) : conserve BookingReminder.type (T_MINUS_24H|T_MINUS_1H) et le
    // payload complet ; les colonnes typées portent le mapping explicite
    // documenté dans `postgres-booking-repository.ts` (saveReminder) :
    // slotId→reservationId, userId→customerId, triggerTime→sendAt.
    builder.createTable("booking_reminders", (table) => {
      table.string("id").primary();
      table.string("reservationId");
      table.string("customerId");
      table.timestamp("sendAt");
      table.enum("status", ["Scheduled", "Sent", "Failed", "Cancelled"]);
      table.timestamp("createdAt").nullable();
      table.json("data").nullable();
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
