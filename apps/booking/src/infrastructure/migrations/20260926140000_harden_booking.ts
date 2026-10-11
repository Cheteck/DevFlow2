import { computeChecksum, type Migration } from "@mosaix/migrations";

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
 */

const upStatements: string[] = [
  // 1. Slots: temporal + capacity columns out of JSONB.
  `ALTER TABLE "booking"."slots" ADD COLUMN IF NOT EXISTS "startAt" TIMESTAMPTZ;`,
  `ALTER TABLE "booking"."slots" ADD COLUMN IF NOT EXISTS "endAt" TIMESTAMPTZ;`,
  `ALTER TABLE "booking"."slots" ADD COLUMN IF NOT EXISTS "capacity" INTEGER DEFAULT 1;`,
  `ALTER TABLE "booking"."slots" ADD COLUMN IF NOT EXISTS "bookedCount" INTEGER DEFAULT 0;`,
  `UPDATE "booking"."slots" SET "startAt" = NULLIF("data"->>'startTime', '')::timestamptz WHERE ("data"->>'startTime') ~ '^\\d{4}-\\d{2}-\\d{2}';`,
  `UPDATE "booking"."slots" SET "endAt" = NULLIF("data"->>'endTime', '')::timestamptz WHERE ("data"->>'endTime') ~ '^\\d{4}-\\d{2}-\\d{2}';`,
  `UPDATE "booking"."slots" SET "capacity" = (("data"->>'capacity')::int) WHERE ("data"->>'capacity') ~ '^\\d+$';`,
  `ALTER TABLE "booking"."slots" ADD CONSTRAINT "slots_time_check" CHECK ("endAt" IS NULL OR "startAt" IS NULL OR "endAt" > "startAt");`,
  `ALTER TABLE "booking"."slots" ADD CONSTRAINT "slots_capacity_check" CHECK ("capacity" >= 1 AND "bookedCount" >= 0 AND "bookedCount" <= "capacity");`,
  `CREATE INDEX IF NOT EXISTS "idx_slots_start_end" ON "booking"."slots" ("startAt", "endAt");`,

  // 2. Reservations survive their slot (history for audits/disputes/billing).
  `ALTER TABLE "booking"."reservations" DROP CONSTRAINT IF EXISTS "fk_booking_reservations_slotId";`,
  `ALTER TABLE "booking"."reservations" ADD CONSTRAINT "fk_booking_reservations_slotId" FOREIGN KEY ("slotId") REFERENCES "booking"."slots" ("id") ON DELETE RESTRICT;`,

  // 3. Waitlists: one active entry per customer and slot; positive rank.
  `CREATE UNIQUE INDEX IF NOT EXISTS "uniq_waitlist_active" ON "booking"."waitlists" ("slotId", "customerId") WHERE "status" = 'waiting';`,
  `ALTER TABLE "booking"."waitlists" ADD CONSTRAINT "waitlists_position_check" CHECK ("position" > 0);`,

  // 4. Reminders: async-worker bookkeeping.
  `ALTER TABLE "booking"."reminders" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMPTZ;`,
  `ALTER TABLE "booking"."reminders" ADD COLUMN IF NOT EXISTS "attempts" INTEGER DEFAULT 0;`,
  `ALTER TABLE "booking"."reminders" ADD COLUMN IF NOT EXISTS "lastError" TEXT;`,
  `ALTER TABLE "booking"."reminders" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;`,
  `ALTER TABLE "booking"."reminders" ADD COLUMN IF NOT EXISTS "provider" VARCHAR(64);`,
  `ALTER TABLE "booking"."reminders" ADD CONSTRAINT "reminders_attempts_check" CHECK ("attempts" >= 0);`,

  // 5. Timestamp defaults (repos keep writing them explicitly).
  `ALTER TABLE "booking"."slots" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "booking"."slots" ALTER COLUMN "updatedAt" SET DEFAULT now();`,
  `ALTER TABLE "booking"."reservations" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "booking"."reservations" ALTER COLUMN "updatedAt" SET DEFAULT now();`,
  `ALTER TABLE "booking"."waitlists" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "booking"."reminders" ALTER COLUMN "createdAt" SET DEFAULT now();`,
];

const downStatements: string[] = [
  `ALTER TABLE "booking"."reminders" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "booking"."waitlists" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "booking"."reservations" ALTER COLUMN "updatedAt" DROP DEFAULT;`,
  `ALTER TABLE "booking"."reservations" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "booking"."slots" ALTER COLUMN "updatedAt" DROP DEFAULT;`,
  `ALTER TABLE "booking"."slots" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "booking"."reminders" DROP CONSTRAINT IF EXISTS "reminders_attempts_check";`,
  `ALTER TABLE "booking"."reminders" DROP COLUMN IF EXISTS "provider";`,
  `ALTER TABLE "booking"."reminders" DROP COLUMN IF EXISTS "updatedAt";`,
  `ALTER TABLE "booking"."reminders" DROP COLUMN IF EXISTS "lastError";`,
  `ALTER TABLE "booking"."reminders" DROP COLUMN IF EXISTS "attempts";`,
  `ALTER TABLE "booking"."reminders" DROP COLUMN IF EXISTS "sentAt";`,
  `ALTER TABLE "booking"."waitlists" DROP CONSTRAINT IF EXISTS "waitlists_position_check";`,
  `DROP INDEX IF EXISTS "booking"."uniq_waitlist_active";`,
  `ALTER TABLE "booking"."reservations" DROP CONSTRAINT IF EXISTS "fk_booking_reservations_slotId";`,
  `ALTER TABLE "booking"."reservations" ADD CONSTRAINT "fk_booking_reservations_slotId" FOREIGN KEY ("slotId") REFERENCES "booking"."slots" ("id") ON DELETE CASCADE;`,
  `DROP INDEX IF EXISTS "booking"."idx_slots_start_end";`,
  `ALTER TABLE "booking"."slots" DROP CONSTRAINT IF EXISTS "slots_capacity_check";`,
  `ALTER TABLE "booking"."slots" DROP CONSTRAINT IF EXISTS "slots_time_check";`,
  `ALTER TABLE "booking"."slots" DROP COLUMN IF EXISTS "bookedCount";`,
  `ALTER TABLE "booking"."slots" DROP COLUMN IF EXISTS "capacity";`,
  `ALTER TABLE "booking"."slots" DROP COLUMN IF EXISTS "endAt";`,
  `ALTER TABLE "booking"."slots" DROP COLUMN IF EXISTS "startAt";`,
];

const sqlContent = upStatements.join("\n");
const sqlDown = downStatements.join("\n");

export const migration: Migration = {
  id: "20260926140000_harden_booking",
  content: sqlContent,
  down: sqlDown,
  checksum: computeChecksum(sqlContent),
  resources: [
    "table:booking.slots",
    "table:booking.reservations",
    "table:booking.waitlists",
    "table:booking.reminders",
  ],
};
