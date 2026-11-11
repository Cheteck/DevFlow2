import {
  type Migration,
  type MigrationContext,
  type MigrationProvider,
} from "@mosaix/migrations";

export const BOOKING_MIGRATION_ID =
  "booking.scheduling.v1.001_create_booking_tables";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "a79c785ff8a62a11e18c0ab9048f9bb7db6074c48f5d8bb96fdd79613622db9d";
/* checksum:end */

/**
 * @apps/booking — Postgres migration manifest (Phase-0 BAC wiring).
 *
 * The migration declares its schema with the SchemaBuilder DSL: the engine
 * compiles the blueprints with the PostgreSQL grammar and executes the
 * resulting statements. No SQL string is carried by the migration.
 *
 * The historical checksum is kept in `legacyChecksums` so that databases
 * where this migration is already applied are not rejected by the Planner.
 */
export class BookingPostgresMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "booking";
  }

  migrations(): readonly Migration[] {
    return [
      {
        id: BOOKING_MIGRATION_ID,
        checksum: MIGRATION_CHECKSUM,
        legacyChecksums: ["822ea2a1818a6e2f"],
        up: (context: MigrationContext) => {
          // 1. Booking Slots — ENUM aligné sur le domaine réellement écrit par le
          // repo (`PostgresBookingRepository.saveSlot` persiste `slot.status` tel
          // quel) : BookingSlotStatus = available|fully_booked|cancelled|held
          // (booking.model.ts:14). Les valeurs DDL historiques
          // (Available|Reserved|Cancelled|Completed) n'étaient jamais écrites.
          context.schema.createTable("booking_slots", (table) => {
            table.string("id").primary();
            table.string("providerId");
            table.enum("status", [
              "available",
              "fully_booked",
              "cancelled",
              "held",
            ]);
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
          context.schema.createTable("booking_reservations", (table) => {
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
            table.unique("uniq_booking_reservations_idempotency", [
              "idempotencyKey",
            ]);
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
          context.schema.createTable("booking_waitlists", (table) => {
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
          context.schema.createTable("booking_reminders", (table) => {
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
        },
        downMigration: (context: MigrationContext) => {
          context.schema.dropTable("booking_reminders");
          context.schema.dropTable("booking_waitlists");
          context.schema.dropTable("booking_reservations");
          context.schema.dropTable("booking_slots");
        },
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
