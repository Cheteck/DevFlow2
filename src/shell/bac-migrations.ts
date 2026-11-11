/**
 * @shell — Phase-0 BAC migration aggregation (transverse wiring, PRD-0006 R7).
 *
 * The shell `MigrationRegistry` is the single aggregation point for every
 * migration provider (PRD-0006 §"le Registry est un agrégateur de providers").
 * This module plugs the 10 BAC providers into that registry without touching
 * BAC SQL content — each wave afterwards owns its schema (backlog
 * DB-BAC-OWNERSHIP).
 *
 * Phase-07 adaptations:
 *
 * 1. TypeScript native migrations only — the engine no longer accepts the
 *    SQL legacy mode (`content`/`down` strings). Every BAC provider now
 *    declares `up(context)` / `downMigration(context)`; the engine compiles
 *    the blueprints and the Runner executes the compiled statements.
 * 2. Canonical ids — the engine sorts the registry with `compareMigrationIds`,
 *    which requires `owner.module.version.sequence_name` (4 dot-parts). The
 *    BAC migrations now carry that id in the module itself: the shell
 *    registers them as they are and never re-invents their metadata
 *    (`CanonicalIdProvider` / `StaticMigrationProvider` are gone).
 * 3. Checksum continuity — the migrations converted from SQL strings keep
 *    their historical checksum in `legacyChecksums`: the Planner accepts an
 *    already-applied migration whose ledger checksum belongs to that list,
 *    so existing databases are not rejected (`MigrationChecksumError`).
 * 4. Subscription ownership — `shell.core.v1.002` owns `user_subscriptions`
 *    (already applied on `mosaix_dev`) while the subscription BAC declares
 *    a divergent schema (BOOLEAN `cancel_at_period_end` against INTEGER).
 *    The exclusion is now effective by construction in the BAC itself
 *    (`apps/subscription` never declares the table); the shell-side SQL
 *    filter (`SubscriptionPhase0Provider`) is gone.
 * 5. Postgres-only gating is decided by the caller
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
import { ManifestMigrationProvider } from "@mosaix/migrations";
import { CitadellePostgresMigrationProvider } from "../../apps/citadelle/src/infrastructure/migrations.js";
import { CommercePostgresMigrationProvider } from "../../apps/commerce/src/infrastructure/migrations.js";
import { BookingPostgresMigrationProvider } from "../../apps/booking/src/infrastructure/migrations.js";
import { ImperiaPostgresMigrationProvider } from "../../apps/imperia/src/infrastructure/migrations.js";
import { SolaraPostgresMigrationProvider } from "../../apps/solara/src/infrastructure/migrations.js";
import { SolidarityPostgresMigrationProvider } from "../../apps/solidarity/src/infrastructure/migrations.js";
import { SubscriptionPostgresMigrationProvider } from "../../apps/subscription/src/infrastructure/migrations.js";
import { migration as beamMessagingMigration } from "../../apps/beam/src/infrastructure/migrations/20260922161700_create_beam_messaging_tables.js";
import { migration as beamSchemaMigration } from "../../apps/beam/src/infrastructure/migrations/20260926090000_move_to_beam_schema.js";
import { migration as spacesMigration } from "../../apps/spaces/src/infrastructure/migrations/20260922162100_create_spaces_tables.js";
import { migration as spacesSchemaMigration } from "../../apps/spaces/src/infrastructure/migrations/20260926096000_move_to_spaces_schema.js";
import { migration as spacesHardeningMigration } from "../../apps/spaces/src/infrastructure/migrations/20260926150000_harden_spaces.js";
import { migration as portfolioTablesMigration } from "../../apps/portfolio/src/infrastructure/migrations/20260922162000_create_portfolio_tables.js";
import { migration as portfolioProposalsMigration } from "../../apps/portfolio/src/infrastructure/migrations/20260924120000_create_portfolio_proposals.js";
import { migration as portfolioSchemaMigration } from "../../apps/portfolio/src/infrastructure/migrations/20260925120000_move_to_portfolio_schema.js";
import { migration as portfolioHardeningMigration } from "../../apps/portfolio/src/infrastructure/migrations/20260925130000_harden_data_integrity.js";
import { migration as portfolioNormalizeMigration } from "../../apps/portfolio/src/infrastructure/migrations/20261010080000_normalize_pim_to_dedicated_tables.js";
import { migration as portfolioNormalizeFixesMigration } from "../../apps/portfolio/src/infrastructure/migrations/20261010100000_normalize_pim_fixes.js";
import { migration as portfolioApprovalFieldsMigration } from "../../apps/portfolio/src/infrastructure/migrations/20261013010000_proposal_approval_fields.js";
import { migration as portfolioTenantIdMigration } from "../../apps/portfolio/src/infrastructure/migrations/20261108120000_add_tenant_id_to_portfolio.js";
import { migration as bookingSchemaMigration } from "../../apps/booking/src/infrastructure/migrations/20260926091000_move_to_booking_schema.js";
import { migration as bookingHardeningMigration } from "../../apps/booking/src/infrastructure/migrations/20260926140000_harden_booking.js";
import { migration as commerceSchemaMigration } from "../../apps/commerce/src/infrastructure/migrations/20260926092000_move_to_commerce_schema.js";
import { migration as commerceHardeningMigration } from "../../apps/commerce/src/infrastructure/migrations/20260926110000_harden_commerce.js";
import { migration as commerceOrderStatusMigration } from "../../apps/commerce/src/infrastructure/migrations/20261013000000_order_pending_payment.js";
import { migration as imperiaSchemaMigration } from "../../apps/imperia/src/infrastructure/migrations/20260926093000_move_to_imperia_schema.js";
import { migration as solidaritySchemaMigration } from "../../apps/solidarity/src/infrastructure/migrations/20260926095000_move_to_solidarity_schema.js";
import { migration as solidarityAllocationsMigration } from "../../apps/solidarity/src/infrastructure/migrations/20261010090000_add_solidarity_allocations.js";
import { migration as subscriptionSchemaMigration } from "../../apps/subscription/src/infrastructure/migrations/20260926097000_move_to_subscription_schema.js";
import { migration as subscriptionHardeningMigration } from "../../apps/subscription/src/infrastructure/migrations/20260926160000_harden_subscription.js";

/**
 * Reference of the canonical ids (`owner.module.version.sequence_name`) of
 * the BAC migrations. The ids are declared by the migration modules
 * themselves — this map is the shell-side index used by the tests to detect
 * any drift between the shell and the applications.
 */
export const BAC_CANONICAL_IDS = {
  beam: "beam.messaging.v1.001_create_messaging_tables",
  beamSchema: "beam.messaging.v1.002_move_to_schema",
  booking: "booking.scheduling.v1.001_create_booking_tables",
  bookingSchema: "booking.scheduling.v1.002_move_to_schema",
  bookingHardening: "booking.scheduling.v1.003_harden_booking",
  citadelle: "citadelle.auth.v1.001_create_auth_tables",
  citadelleMfaSecrets: "citadelle.mfa.v1.002_create_mfa_secrets",
  commerce: "commerce.shop.v1.001_create_commerce_tables",
  commerceSchema: "commerce.shop.v1.002_move_to_schema",
  commerceHardening: "commerce.shop.v1.003_harden_commerce",
  commerceOrderStatus: "commerce.shop.v1.004_order_pending_payment",
  imperia: "imperia.ops.v1.001_create_imperia_tables",
  imperiaSchema: "imperia.ops.v1.002_move_to_schema",
  portfolioTables: "portfolio.catalog.v1.001_create_portfolio_tables",
  portfolioProposals: "portfolio.catalog.v1.002_create_proposals",
  portfolioSchema: "portfolio.catalog.v1.003_move_to_schema",
  portfolioHardening: "portfolio.catalog.v1.004_harden_data_integrity",
  portfolioNormalize: "portfolio.catalog.v1.005_normalize_pim",
  portfolioNormalizeFixes: "portfolio.catalog.v1.006_normalize_fixes",
  portfolioApprovalFields: "portfolio.catalog.v1.007_approval_fields",
  portfolioTenantId: "portfolio.catalog.v1.008_tenant_id",
  solara: "solara.social.v1.001_create_social_tables",
  solaraSchema: "solara.social.v1.002_move_to_schema",
  solaraHardening: "solara.social.v1.003_harden_social",
  solidarity: "solidarity.relief.v1.001_create_solidarity_tables",
  solidaritySchema: "solidarity.relief.v1.002_move_to_schema",
  solidarityAllocations: "solidarity.relief.v1.003_allocations",
  spaces: "spaces.membership.v1.001_create_spaces_tables",
  spacesSchema: "spaces.membership.v1.002_move_to_schema",
  spacesHardening: "spaces.membership.v1.003_harden_rbac",
  subscription: "subscription.billing.v1.001_create_billing_tables",
  subscriptionSchema: "subscription.billing.v1.002_move_to_schema",
  subscriptionHardening: "subscription.billing.v1.003_harden_billing",
} as const;

/** Registration rank for every BAC provider: after shell-core (rank 0). */
export const BAC_MIGRATION_RANK = 1;

/** The 10 BAC providers in deterministic (owner-alphabetical) order. */
export function createBacMigrationProviders(): readonly MigrationProvider[] {
  return [
    new ManifestMigrationProvider("beam", [
      beamMessagingMigration,
      beamSchemaMigration,
    ]),
    new BookingPostgresMigrationProvider(),
    new ManifestMigrationProvider("booking", [
      bookingSchemaMigration,
      bookingHardeningMigration,
    ]),
    new CitadellePostgresMigrationProvider(),
    new CommercePostgresMigrationProvider(),
    new ManifestMigrationProvider("commerce", [
      commerceSchemaMigration,
      commerceHardeningMigration,
      commerceOrderStatusMigration,
    ]),
    new ImperiaPostgresMigrationProvider(),
    new ManifestMigrationProvider("imperia", [imperiaSchemaMigration]),
    new ManifestMigrationProvider("portfolio", [
      portfolioTablesMigration,
      portfolioProposalsMigration,
      portfolioSchemaMigration,
      portfolioHardeningMigration,
      portfolioNormalizeMigration,
      portfolioNormalizeFixesMigration,
      portfolioApprovalFieldsMigration,
      portfolioTenantIdMigration,
    ]),
    new SolaraPostgresMigrationProvider(),
    new SolidarityPostgresMigrationProvider(),
    new ManifestMigrationProvider("solidarity", [
      solidaritySchemaMigration,
      solidarityAllocationsMigration,
    ]),
    new ManifestMigrationProvider("spaces", [
      spacesMigration,
      spacesSchemaMigration,
      spacesHardeningMigration,
    ]),
    new SubscriptionPostgresMigrationProvider(),
    new ManifestMigrationProvider("subscription", [
      subscriptionSchemaMigration,
      subscriptionHardeningMigration,
    ]),
  ];
}

/**
 * Every BAC migration, flattened — the shell-side view used by the tests to
 * check the canonical ids and the resource ownership matrix.
 */
export function createBacMigrations(): readonly Migration[] {
  return createBacMigrationProviders().flatMap((provider) =>
    provider.migrations(),
  );
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
