/**
 * @shell — Phase-0 BAC migration aggregation (transverse wiring, PRD-0006 R7).
 *
 * The shell `MigrationRegistry` is the single aggregation point for every
 * migration provider (PRD-0006 §"le Registry est un agrégateur de providers").
 * This module plugs the 10 BAC providers into that registry without touching
 * BAC SQL content — each wave afterwards owns its schema (backlog
 * DB-BAC-OWNERSHIP).
 *
 * Phase-0 adaptations (envelope only, SQL bytes preserved):
 *
 * 1. Canonical ids — the engine sorts the registry with `compareMigrationIds`,
 *    which requires `owner.module.version.sequence_name` (4 dot-parts). The
 *    BAC providers ship 3-part ids (`citadelle.v1.001_…`) and the standalone
 *    files ship timestamp ids (`20260922161700_…`): registering them raw
 *    throws `Invalid migration id` from `registry.all()` as soon as 2+
 *    migrations are compared (verified by execution). Each migration is
 *    therefore re-exposed under a canonical id; checksums are recomputed from
 *    content at registration by `loadMigration`, so ledger integrity holds.
 * 2. `export const migration` files (beam, spaces, portfolio ×2) are wrapped
 *    in providers carrying their `ownerId` — same uniformisation, no SQL
 *    change.
 * 3. Subscription collision — `shell.core.v1.002` (already applied on
 *    `mosaix_dev`) owns `user_subscriptions` with an INTEGER-based schema
 *    while `subscription.v1.001` declares the same table with a divergent
 *    schema (BOOLEAN `cancel_at_period_end`), and `PostgresGrammar`
 *    emits plain `CREATE TABLE` (no `IF NOT EXISTS`): applying both would
 *    crash and risk data loss. Minimal decision, no data loss: the shell
 *    stays the temporary owner (see DB-BAC-OWNERSHIP note in
 *    `src/shell/database/core-migration.ts`), so the Phase-0 subscription
 *    migration ships every statement EXCEPT those creating
 *    `user_subscriptions` (its `CREATE TABLE`, its `CREATE INDEX … ON`, its
 *    `DROP TABLE` in `down` — a rollback must never drop the shell-owned
 *    table). Foreign keys FROM `invoices`/`metering_buckets` TO
 *    `user_subscriptions` are preserved: the shell creates that table first
 *    (rank 0 before rank 1), so the references resolve. Full ownership
 *    transfer (including the table) is the subscription wave's job.
 * 4. Postgres-only gating is decided by the caller
 *    (`createShellMigrationRegistry` registers BAC providers only for
 *    `dialect === "postgres"`): all 10 providers emit `PostgresGrammar` SQL
 *    (`JSONB`, `TIMESTAMP WITH TIME ZONE`, `ON DELETE CASCADE`) that was
 *    never validated for SQLite, and registering them for SQLite would break
 *    the local SQLite boot/migrate flow (shell tables already created by
 *    `shell.core.v1.001` would collide with BAC `CREATE TABLE`s).
 *
 * Orphan migrations DELIBERATELY excluded (broken or hardening patches —
 * each BAC wave's job, see session report):
 *
 * - `apps/commerce/.../20260922161600_normalize_commerce_orders.ts`
 * - `apps/booking/.../20260922161800_harden_booking_constraints.ts`
 *   (indexes non-existent `startTime`/`endTime` columns — MUST NOT apply)
 * - `apps/solidarity/.../20260922161900_add_solidarity_transaction_state.ts`
 *   (ALTERs non-existent `solidarity_offers`)
 * - `apps/citadelle/.../20260922161500_harden_citadelle_security.ts`
 *   (hardening ALTERs, to be evaluated by the citadelle wave)
 *
 * Ordering: shell providers keep rank 0, every BAC provider registers at
 * rank 1 — shell-core always first, then BAC in deterministic canonical-id
 * order (no cross-BAC foreign keys expected).
 */
import type {
  Migration,
  MigrationProvider,
  MigrationRegistry,
} from "@mosaix/migrations";
import { CitadellePostgresMigrationProvider } from "../../apps/citadelle/src/infrastructure/migrations.js";
import { CommercePostgresMigrationProvider } from "../../apps/commerce/src/infrastructure/migrations.js";
import { BookingPostgresMigrationProvider } from "../../apps/booking/src/infrastructure/migrations.js";
import { ImperiaPostgresMigrationProvider } from "../../apps/imperia/src/infrastructure/migrations.js";
import { SolaraPostgresMigrationProvider } from "../../apps/solara/src/infrastructure/migrations.js";
import { SolidarityPostgresMigrationProvider } from "../../apps/solidarity/src/infrastructure/migrations.js";
import { SubscriptionPostgresMigrationProvider } from "../../apps/subscription/src/infrastructure/migrations.js";
import { migration as beamMessagingMigration } from "../../apps/beam/src/infrastructure/migrations/20260922161700_create_beam_messaging_tables.js";
import { migration as spacesMigration } from "../../apps/spaces/src/infrastructure/migrations/20260922162100_create_spaces_tables.js";
import { migration as portfolioTablesMigration } from "../../apps/portfolio/src/infrastructure/migrations/20260922162000_create_portfolio_tables.js";
import { migration as portfolioProposalsMigration } from "../../apps/portfolio/src/infrastructure/migrations/20260924120000_create_portfolio_proposals.js";

/** Canonical Phase-0 ids (`owner.module.version.sequence_name`). */
export const BAC_CANONICAL_IDS = {
  beam: "beam.messaging.v1.001_create_messaging_tables",
  booking: "booking.scheduling.v1.001_create_booking_tables",
  citadelle: "citadelle.auth.v1.001_create_auth_tables",
  commerce: "commerce.shop.v1.001_create_commerce_tables",
  imperia: "imperia.ops.v1.001_create_imperia_tables",
  portfolioTables: "portfolio.catalog.v1.001_create_portfolio_tables",
  portfolioProposals: "portfolio.catalog.v1.002_create_proposals",
  solara: "solara.social.v1.001_create_social_tables",
  solidarity: "solidarity.relief.v1.001_create_solidarity_tables",
  spaces: "spaces.membership.v1.001_create_spaces_tables",
  subscription: "subscription.billing.v1.001_create_billing_tables",
} as const;

/** Registration rank for every BAC provider: after shell-core (rank 0). */
export const BAC_MIGRATION_RANK = 1;

/**
 * Re-exposes an inner provider's migrations under canonical ids.
 * Length guard: if a BAC wave adds a migration to the inner provider, this
 * throws loudly instead of silently mis-mapping ids.
 */
class CanonicalIdProvider implements MigrationProvider {
  constructor(
    private readonly inner: MigrationProvider,
    private readonly ids: readonly string[],
  ) {}

  ownerId(): string {
    return this.inner.ownerId();
  }

  migrations(): readonly Migration[] {
    const inner = this.inner.migrations();
    if (inner.length !== this.ids.length) {
      throw new Error(
        `[bac-migrations] provider "${this.ownerId()}" now ships ${inner.length} migration(s), ` +
          `Phase-0 mapping declares ${this.ids.length}: update the canonical id mapping.`,
      );
    }
    return inner.map((migration, index) => ({
      ...migration,
      id: this.ids[index] as string,
    }));
  }
}

/** Wraps a standalone `export const migration` under an owner + canonical id. */
class StaticMigrationProvider implements MigrationProvider {
  constructor(
    private readonly owner: string,
    private readonly canonicalId: string,
    private readonly migration: Migration,
  ) {}

  ownerId(): string {
    return this.owner;
  }

  migrations(): readonly Migration[] {
    return [{ ...this.migration, id: this.canonicalId }];
  }
}

/**
 * True for statements that CREATE/INDEX/DROP the shell-owned
 * `user_subscriptions` table. Narrow on purpose: `CREATE TABLE "invoices"`
 * and `CREATE TABLE "metering_buckets"` reference `"user_subscriptions"` in
 * a `REFERENCES` clause and MUST be kept (the shell table exists first, so
 * those foreign keys resolve).
 */
function isShellOwnedUserSubscriptionsStatement(statement: string): boolean {
  return (
    statement.includes('TABLE "user_subscriptions"') ||
    statement.includes('ON "user_subscriptions"')
  );
}

function withoutStatements(
  sql: string,
  exclude: (statement: string) => boolean,
): string {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0 && !exclude(statement))
    .map((statement) => `${statement};`)
    .join("\n");
}

/**
 * Phase-0 subscription view: same provider, same SQL bytes for the kept
 * statements, minus every statement that would recreate the shell-owned
 * `user_subscriptions` table (up AND down — a rollback must never drop the
 * shell table). See module header §3 for the ownership decision.
 */
class SubscriptionPhase0Provider implements MigrationProvider {
  private readonly inner = new SubscriptionPostgresMigrationProvider();

  ownerId(): string {
    return "subscription";
  }

  migrations(): readonly Migration[] {
    const inner = this.inner.migrations();
    if (inner.length !== 1 || inner[0] === undefined) {
      throw new Error(
        `[bac-migrations] subscription provider shape changed (${inner.length} migration(s)): ` +
          `update the Phase-0 user_subscriptions filter.`,
      );
    }
    const migration = inner[0];
    return [
      {
        ...migration,
        id: BAC_CANONICAL_IDS.subscription,
        content: withoutStatements(
          migration.content,
          isShellOwnedUserSubscriptionsStatement,
        ),
        down:
          migration.down === undefined
            ? undefined
            : withoutStatements(
                migration.down,
                isShellOwnedUserSubscriptionsStatement,
              ),
        resources: migration.resources.filter(
          (resource) => resource !== "table:user_subscriptions",
        ),
      },
    ];
  }
}

/** The 10 BAC providers in deterministic (owner-alphabetical) order. */
export function createBacMigrationProviders(): readonly MigrationProvider[] {
  return [
    new StaticMigrationProvider(
      "beam",
      BAC_CANONICAL_IDS.beam,
      beamMessagingMigration,
    ),
    new CanonicalIdProvider(new BookingPostgresMigrationProvider(), [
      BAC_CANONICAL_IDS.booking,
    ]),
    new CanonicalIdProvider(new CitadellePostgresMigrationProvider(), [
      BAC_CANONICAL_IDS.citadelle,
    ]),
    new CanonicalIdProvider(new CommercePostgresMigrationProvider(), [
      BAC_CANONICAL_IDS.commerce,
    ]),
    new CanonicalIdProvider(new ImperiaPostgresMigrationProvider(), [
      BAC_CANONICAL_IDS.imperia,
    ]),
    new StaticMigrationProvider(
      "portfolio",
      BAC_CANONICAL_IDS.portfolioTables,
      portfolioTablesMigration,
    ),
    new StaticMigrationProvider(
      "portfolio",
      BAC_CANONICAL_IDS.portfolioProposals,
      portfolioProposalsMigration,
    ),
    new CanonicalIdProvider(new SolaraPostgresMigrationProvider(), [
      BAC_CANONICAL_IDS.solara,
    ]),
    new CanonicalIdProvider(new SolidarityPostgresMigrationProvider(), [
      BAC_CANONICAL_IDS.solidarity,
    ]),
    new StaticMigrationProvider(
      "spaces",
      BAC_CANONICAL_IDS.spaces,
      spacesMigration,
    ),
    new SubscriptionPhase0Provider(),
  ];
}

/**
 * Registers the 10 BAC providers on the aggregated shell registry at
 * {@link BAC_MIGRATION_RANK} (shell-core stays rank 0, hence first).
 */
export function registerBacMigrations(
  registry: MigrationRegistry,
  rank: number = BAC_MIGRATION_RANK,
): void {
  for (const provider of createBacMigrationProviders()) {
    registry.register(provider, rank);
  }
}
