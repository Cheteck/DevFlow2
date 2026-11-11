import {
  cast,
  equals,
  func,
  jsonPath,
  matchesPattern,
  nullIf,
  value,
  type Migration,
  type MigrationContext,
} from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM = "3096f045d1dc34cd1c95e7bc35fa26176d39956c5af71ac7db02eea2b97672da";
/* checksum:end */

/**
 * booking.scheduling.v1.003 — harden reservation integrity (critique schéma).
 *
 * Verified against the live DB before writing: PKs exist on all 4 tables,
 * creation order is correct, FKs present, idempotency UNIQUE exists (as an
 * index) — those claims do NOT apply to our compiled migrations. This
 * migration adds what is REALLY missing, on the `booking.*` names (v1.002):
 *
 * - slots: explicit startAt/endAt/capacity/bookedCount columns (temporal
 *   data lived only in data JSONB, unqueryable and unconstrainable);
 *   backfilled from data JSONB where ISO-shaped; CHECKs on chronology and
 *   capacity; index (startAt, endAt) for availability scans.
 * - reservations.slotId FK: CASCADE → RESTRICT (no slot deletion while
 *   reservations exist; cancel slots instead of deleting them). No slot
 *   deletion code path exists, so this is behavior-preserving.
 * - waitlists: one active entry per (slotId, customerId)
 *   (partial UNIQUE WHERE waiting); position strictly positive.
 * - reminders: processing columns for reliable async workers
 *   (sentAt, attempts, lastError, updatedAt, provider).
 * - DEFAULT now() on createdAt everywhere.
 *
 * The atomic hold itself (UPDATE ... WHERE bookedCount + qty <= capacity)
 * lives in PostgresBookingRepository.holdSlot; the DB columns make it
 * expressible. Postgres-only.
 *
 * The schema is declared with the SchemaBuilder DSL: the engine compiles the
 * blueprints with the PostgreSQL grammar and executes the resulting
 * statements. No SQL string is carried by the migration.
 *
 * Historical note: this migration was previously declared as a raw SQL
 * string (SQL legacy mode, removed from the engine). Its historical
 * checksum is kept in `legacyChecksums` so that databases where it is
 * already applied are not rejected by the Planner.
 */

export const migration: Migration = {
  id: "booking.scheduling.v1.003_harden_booking",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["fb178f45345fa87d"],
  resources: [
    // v1.003_harden_booking MODIFIE (ne CREATE pas) ces tables existantes.
    // R9 exige au moins une ressource déclarée pour la détection de collisions.
    "table:booking.slots",
    "table:booking.reservations",
    "table:booking.waitlists",
    "table:booking.reminders",
  ],
  up: (context: MigrationContext) => {
    context.schema.addColumn(
      { schema: "booking", name: "slots" },
      "startAt",
      "timestamp",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true },
    );
    context.schema.addColumn(
      { schema: "booking", name: "slots" },
      "endAt",
      "timestamp",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true },
    );
    context.schema.addColumn(
      { schema: "booking", name: "slots" },
      "capacity",
      "integer",
      (col) => {
        col.nullable();
        col.default(1);
      },
      { ifNotExists: true },
    );
    context.schema.addColumn(
      { schema: "booking", name: "slots" },
      "bookedCount",
      "integer",
      (col) => {
        col.nullable();
        col.default(0);
      },
      { ifNotExists: true },
    );
    context.data.update(
      { schema: "booking", name: "slots" },
      {
        startAt: cast(
          nullIf(jsonPath("data", "startTime"), value("")),
          "timestamptz",
        ),
      },
      [
        matchesPattern(
          jsonPath("data", "startTime"),
          value("^\\d{4}-\\d{2}-\\d{2}"),
        ),
      ],
    );
    context.data.update(
      { schema: "booking", name: "slots" },
      {
        endAt: cast(
          nullIf(jsonPath("data", "endTime"), value("")),
          "timestamptz",
        ),
      },
      [
        matchesPattern(
          jsonPath("data", "endTime"),
          value("^\\d{4}-\\d{2}-\\d{2}"),
        ),
      ],
    );
    context.data.update(
      { schema: "booking", name: "slots" },
      { capacity: cast(jsonPath("data", "capacity"), "int") },
      [matchesPattern(jsonPath("data", "capacity"), value("^\\d+$"))],
    );
    context.schema.addConstraint(
      { schema: "booking", name: "slots" },
      "slots_time_check",
      'CHECK ("endAt" IS NULL OR "startAt" IS NULL OR "endAt" > "startAt")',
    );
    context.schema.addConstraint(
      { schema: "booking", name: "slots" },
      "slots_capacity_check",
      'CHECK ("capacity" >= 1 AND "bookedCount" >= 0 AND "bookedCount" <= "capacity")',
    );
    context.schema.createIndex(
      { schema: "booking", name: "slots" },
      "idx_slots_start_end",
      [{ name: "startAt" }, { name: "endAt" }],
      { ifNotExists: true },
    );
    context.schema.dropConstraint(
      { schema: "booking", name: "reservations" },
      "fk_booking_reservations_slotId",
    );
    context.schema.addConstraint(
      { schema: "booking", name: "reservations" },
      "fk_booking_reservations_slotId",
      'FOREIGN KEY ("slotId") REFERENCES "booking"."slots" ("id") ON DELETE RESTRICT',
    );
    context.schema.createIndex(
      { schema: "booking", name: "waitlists" },
      "uniq_waitlist_active",
      [{ name: "slotId" }, { name: "customerId" }],
      {
        unique: true,
        ifNotExists: true,
        where: [equals("status", value("waiting"))],
      },
    );
    context.schema.addConstraint(
      { schema: "booking", name: "waitlists" },
      "waitlists_position_check",
      'CHECK ("position" > 0)',
    );
    context.schema.addColumn(
      { schema: "booking", name: "reminders" },
      "sentAt",
      "timestamp",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true },
    );
    context.schema.addColumn(
      { schema: "booking", name: "reminders" },
      "attempts",
      "integer",
      (col) => {
        col.nullable();
        col.default(0);
      },
      { ifNotExists: true },
    );
    context.schema.addColumn(
      { schema: "booking", name: "reminders" },
      "lastError",
      "text",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true },
    );
    context.schema.addColumn(
      { schema: "booking", name: "reminders" },
      "updatedAt",
      "timestamp",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true },
    );
    context.schema.addColumn(
      { schema: "booking", name: "reminders" },
      "provider",
      "string",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true, length: 64 },
    );
    context.schema.addConstraint(
      { schema: "booking", name: "reminders" },
      "reminders_attempts_check",
      'CHECK ("attempts" >= 0)',
    );
    context.schema.alterColumnDefault(
      { schema: "booking", name: "slots" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "booking", name: "slots" },
      "updatedAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "booking", name: "reservations" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "booking", name: "reservations" },
      "updatedAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "booking", name: "waitlists" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "booking", name: "reminders" },
      "createdAt",
      func("now"),
    );
  },
  downMigration: (context: MigrationContext) => {
    context.schema.alterColumnDefault(
      { schema: "booking", name: "reminders" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "booking", name: "waitlists" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "booking", name: "reservations" },
      "updatedAt",
    );
    context.schema.alterColumnDefault(
      { schema: "booking", name: "reservations" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "booking", name: "slots" },
      "updatedAt",
    );
    context.schema.alterColumnDefault(
      { schema: "booking", name: "slots" },
      "createdAt",
    );
    context.schema.dropConstraint(
      { schema: "booking", name: "reminders" },
      "reminders_attempts_check",
    );
    context.schema.dropColumn(
      { schema: "booking", name: "reminders" },
      "provider",
      { ifExists: true },
    );
    context.schema.dropColumn(
      { schema: "booking", name: "reminders" },
      "updatedAt",
      { ifExists: true },
    );
    context.schema.dropColumn(
      { schema: "booking", name: "reminders" },
      "lastError",
      { ifExists: true },
    );
    context.schema.dropColumn(
      { schema: "booking", name: "reminders" },
      "attempts",
      { ifExists: true },
    );
    context.schema.dropColumn(
      { schema: "booking", name: "reminders" },
      "sentAt",
      { ifExists: true },
    );
    context.schema.dropConstraint(
      { schema: "booking", name: "waitlists" },
      "waitlists_position_check",
    );
    context.schema.dropIndex("uniq_waitlist_active", "booking");
    context.schema.dropConstraint(
      { schema: "booking", name: "reservations" },
      "fk_booking_reservations_slotId",
    );
    context.schema.addConstraint(
      { schema: "booking", name: "reservations" },
      "fk_booking_reservations_slotId",
      'FOREIGN KEY ("slotId") REFERENCES "booking"."slots" ("id") ON DELETE CASCADE',
    );
    context.schema.dropIndex("idx_slots_start_end", "booking");
    context.schema.dropConstraint(
      { schema: "booking", name: "slots" },
      "slots_capacity_check",
    );
    context.schema.dropConstraint(
      { schema: "booking", name: "slots" },
      "slots_time_check",
    );
    context.schema.dropColumn(
      { schema: "booking", name: "slots" },
      "bookedCount",
      { ifExists: true },
    );
    context.schema.dropColumn(
      { schema: "booking", name: "slots" },
      "capacity",
      { ifExists: true },
    );
    context.schema.dropColumn({ schema: "booking", name: "slots" }, "endAt", {
      ifExists: true,
    });
    context.schema.dropColumn({ schema: "booking", name: "slots" }, "startAt", {
      ifExists: true,
    });
  },
};
