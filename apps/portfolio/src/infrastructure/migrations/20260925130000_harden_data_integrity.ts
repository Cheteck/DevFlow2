import { computeChecksum, type Migration } from "@mosaix/migrations";

/**
 * portfolio.catalog.v1.004 — harden data integrity (critique schéma).
 *
 * Verified against the live DB before writing: all `ON ""`/syntax/order
 * claims do NOT apply to our compiled migrations (indexes valid, tables
 * created parents-first, FKs present). This migration adds what is REALLY
 * missing, on the `portfolio.*` names (v1.003):
 *
 * - categories: forbid self-parent (indirect cycles stay app-level).
 * - relations: forbid self-reference + UNIQUE(source, target, relationType).
 * - feature_variants: UNIQUE(id, featureId) so value assignments can be
 *   proven compatible via composite foreign keys.
 * - vendable_features / variant_features: value modes are mutually exclusive
 *   (never both filled) + composite FK proving the value belongs to the
 *   referenced feature (replaces the single-column FKs).
 * - variation_groups: UNIQUE(parentVendableId, code);
 *   variation_group_features: UNIQUE(groupId, featureId).
 * - proposals: CHECK on type/status (same lists as the domain); vendableId
 *   FK ON DELETE CASCADE → SET NULL (moderation history survives product
 *   deletion; vendableId is nullable by design).
 * - media_assets.type: CHECK (image/video/pdf/document, same as MediaItem).
 * - TEXT instead of VARCHAR(255) for long free text (signed URLs, long
 *   descriptions, feedback/rejection reasons, feature descriptions).
 * - DEFAULT now() on every createdAt/updatedAt (repos still write them
 *   explicitly; the default only hardens direct SQL).
 * - updatedAt auto-touch trigger on the 3 tables that carry updatedAt
 *   (vendables, variants, proposals).
 * - Drop 3 redundant indexes (covered leftmost by UNIQUE constraints);
 *   add relations(targetVendableId) for reverse lookups.
 *
 * Postgres-only (like v1.001–v1.003).
 */

const upStatements: string[] = [
  // 1. Categories: no self-parent.
  `ALTER TABLE "portfolio"."categories" ADD CONSTRAINT "categories_no_self_parent" CHECK ("parentId" IS DISTINCT FROM "id");`,

  // 2. Relations: no self-reference, no duplicate triple.
  `ALTER TABLE "portfolio"."relations" ADD CONSTRAINT "relations_no_self_reference" CHECK ("sourceVendableId" <> "targetVendableId");`,
  `ALTER TABLE "portfolio"."relations" ADD CONSTRAINT "relations_source_target_type_unique" UNIQUE ("sourceVendableId", "targetVendableId", "relationType");`,

  // 3. feature_variants: composite uniqueness anchor for compatible assignments.
  `ALTER TABLE "portfolio"."feature_variants" ADD CONSTRAINT "feature_values_id_feature_unique" UNIQUE ("id", "featureId");`,

  // 4. vendable_features: exclusive value modes + proven-compatible value.
  `ALTER TABLE "portfolio"."vendable_features" ADD CONSTRAINT "vendable_features_value_exclusive" CHECK (NOT ("valueText" IS NOT NULL AND "variantId" IS NOT NULL));`,
  `ALTER TABLE "portfolio"."vendable_features" DROP CONSTRAINT IF EXISTS "fk_portfolio_vendable_features_variantId";`,
  `ALTER TABLE "portfolio"."vendable_features" ADD CONSTRAINT "vendable_features_variant_value_compatible" FOREIGN KEY ("variantId", "featureId") REFERENCES "portfolio"."feature_variants" ("id", "featureId");`,

  // 5. variant_features: same treatment (variantValueId variant).
  `ALTER TABLE "portfolio"."variant_features" ADD CONSTRAINT "variant_features_value_exclusive" CHECK (NOT ("valueText" IS NOT NULL AND "variantValueId" IS NOT NULL));`,
  `ALTER TABLE "portfolio"."variant_features" DROP CONSTRAINT IF EXISTS "fk_portfolio_variant_features_variantValueId";`,
  `ALTER TABLE "portfolio"."variant_features" ADD CONSTRAINT "variant_features_value_compatible" FOREIGN KEY ("variantValueId", "featureId") REFERENCES "portfolio"."feature_variants" ("id", "featureId");`,

  // 6. Variation groups: unique code per parent, unique feature per group.
  `ALTER TABLE "portfolio"."variation_groups" ADD CONSTRAINT "variation_groups_parent_code_unique" UNIQUE ("parentVendableId", "code");`,
  `ALTER TABLE "portfolio"."variation_group_features" ADD CONSTRAINT "variation_group_features_unique" UNIQUE ("groupId", "featureId");`,

  // 7. Proposals: controlled type/status vocabularies (domain lists).
  `ALTER TABLE "portfolio"."proposals" ADD CONSTRAINT "proposals_type_check" CHECK ("type" IN ('Product', 'Service', 'DigitalProduct', 'Experience'));`,
  `ALTER TABLE "portfolio"."proposals" ADD CONSTRAINT "proposals_status_check" CHECK ("status" IN ('Draft', 'Submitted', 'InReview', 'ChangesRequested', 'Approved', 'Rejected', 'Withdrawn', 'Archived'));`,

  // 8. Proposals keep moderation history when the product is deleted.
  `ALTER TABLE "portfolio"."proposals" DROP CONSTRAINT IF EXISTS "fk_portfolio_proposals_vendableId";`,
  `ALTER TABLE "portfolio"."proposals" ADD CONSTRAINT "fk_portfolio_proposals_vendableId" FOREIGN KEY ("vendableId") REFERENCES "portfolio"."vendables" ("id") ON DELETE SET NULL;`,

  // 9. Media types controlled (MediaItem union).
  `ALTER TABLE "portfolio"."media_assets" ADD CONSTRAINT "media_assets_type_check" CHECK ("type" IN ('image', 'video', 'pdf', 'document'));`,

  // 10. Long free text: TEXT instead of VARCHAR(255).
  `ALTER TABLE "portfolio"."media_assets" ALTER COLUMN "url" TYPE TEXT;`,
  `ALTER TABLE "portfolio"."translations" ALTER COLUMN "description" TYPE TEXT;`,
  `ALTER TABLE "portfolio"."proposals" ALTER COLUMN "platformFeedback" TYPE TEXT;`,
  `ALTER TABLE "portfolio"."proposals" ALTER COLUMN "rejectionReason" TYPE TEXT;`,
  `ALTER TABLE "portfolio"."features" ALTER COLUMN "description" TYPE TEXT;`,

  // 11. Timestamp defaults (repos keep writing them explicitly).
  `ALTER TABLE "portfolio"."categories" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "portfolio"."feature_groups" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "portfolio"."feature_variants" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "portfolio"."features" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "portfolio"."media_assets" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "portfolio"."proposals" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "portfolio"."proposals" ALTER COLUMN "updatedAt" SET DEFAULT now();`,
  `ALTER TABLE "portfolio"."relations" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "portfolio"."translations" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "portfolio"."variants" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "portfolio"."variants" ALTER COLUMN "updatedAt" SET DEFAULT now();`,
  `ALTER TABLE "portfolio"."variation_groups" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "portfolio"."vendable_features" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "portfolio"."vendables" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "portfolio"."vendables" ALTER COLUMN "updatedAt" SET DEFAULT now();`,

  // 12. updatedAt auto-touch on the 3 tables carrying updatedAt.
  `CREATE OR REPLACE FUNCTION "portfolio"."set_updated_at"() RETURNS TRIGGER AS $$ BEGIN NEW."updatedAt" = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;`,
  `DROP TRIGGER IF EXISTS "trg_vendables_updated_at" ON "portfolio"."vendables";`,
  `CREATE TRIGGER "trg_vendables_updated_at" BEFORE UPDATE ON "portfolio"."vendables" FOR EACH ROW EXECUTE FUNCTION "portfolio"."set_updated_at"();`,
  `DROP TRIGGER IF EXISTS "trg_variants_updated_at" ON "portfolio"."variants";`,
  `CREATE TRIGGER "trg_variants_updated_at" BEFORE UPDATE ON "portfolio"."variants" FOR EACH ROW EXECUTE FUNCTION "portfolio"."set_updated_at"();`,
  `DROP TRIGGER IF EXISTS "trg_proposals_updated_at" ON "portfolio"."proposals";`,
  `CREATE TRIGGER "trg_proposals_updated_at" BEFORE UPDATE ON "portfolio"."proposals" FOR EACH ROW EXECUTE FUNCTION "portfolio"."set_updated_at"();`,

  // 13. Drop indexes redundant with UNIQUE leftmost prefixes.
  `DROP INDEX IF EXISTS "portfolio"."idx_feature_variants_feature";`,
  `DROP INDEX IF EXISTS "portfolio"."idx_vendable_features_vendable";`,
  `DROP INDEX IF EXISTS "portfolio"."idx_portfolio_trans_vendable_lang";`,

  // 14. Reverse-lookup index (FKs don't self-index; deletes/joins need it).
  `CREATE INDEX IF NOT EXISTS "idx_relations_target" ON "portfolio"."relations" ("targetVendableId");`,
];

const downStatements: string[] = [
  `DROP INDEX IF EXISTS "portfolio"."idx_relations_target";`,
  `DROP TRIGGER IF EXISTS "trg_proposals_updated_at" ON "portfolio"."proposals";`,
  `DROP TRIGGER IF EXISTS "trg_variants_updated_at" ON "portfolio"."variants";`,
  `DROP TRIGGER IF EXISTS "trg_vendables_updated_at" ON "portfolio"."vendables";`,
  `DROP FUNCTION IF EXISTS "portfolio"."set_updated_at"();`,
  `ALTER TABLE "portfolio"."vendables" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "portfolio"."vendables" ALTER COLUMN "updatedAt" DROP DEFAULT;`,
  `ALTER TABLE "portfolio"."vendable_features" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "portfolio"."variation_groups" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "portfolio"."variants" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "portfolio"."variants" ALTER COLUMN "updatedAt" DROP DEFAULT;`,
  `ALTER TABLE "portfolio"."translations" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "portfolio"."relations" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "portfolio"."proposals" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "portfolio"."proposals" ALTER COLUMN "updatedAt" DROP DEFAULT;`,
  `ALTER TABLE "portfolio"."media_assets" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "portfolio"."features" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "portfolio"."feature_variants" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "portfolio"."feature_groups" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "portfolio"."categories" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "portfolio"."features" ALTER COLUMN "description" TYPE VARCHAR(255);`,
  `ALTER TABLE "portfolio"."proposals" ALTER COLUMN "rejectionReason" TYPE VARCHAR(255);`,
  `ALTER TABLE "portfolio"."proposals" ALTER COLUMN "platformFeedback" TYPE VARCHAR(255);`,
  `ALTER TABLE "portfolio"."translations" ALTER COLUMN "description" TYPE VARCHAR(255);`,
  `ALTER TABLE "portfolio"."media_assets" ALTER COLUMN "url" TYPE VARCHAR(255);`,
  `ALTER TABLE "portfolio"."media_assets" DROP CONSTRAINT IF EXISTS "media_assets_type_check";`,
  `ALTER TABLE "portfolio"."proposals" DROP CONSTRAINT IF EXISTS "fk_portfolio_proposals_vendableId";`,
  `ALTER TABLE "portfolio"."proposals" ADD CONSTRAINT "fk_portfolio_proposals_vendableId" FOREIGN KEY ("vendableId") REFERENCES "portfolio"."vendables" ("id") ON DELETE CASCADE;`,
  `ALTER TABLE "portfolio"."proposals" DROP CONSTRAINT IF EXISTS "proposals_status_check";`,
  `ALTER TABLE "portfolio"."proposals" DROP CONSTRAINT IF EXISTS "proposals_type_check";`,
  `ALTER TABLE "portfolio"."variation_group_features" DROP CONSTRAINT IF EXISTS "variation_group_features_unique";`,
  `ALTER TABLE "portfolio"."variation_groups" DROP CONSTRAINT IF EXISTS "variation_groups_parent_code_unique";`,
  `ALTER TABLE "portfolio"."variant_features" DROP CONSTRAINT IF EXISTS "variant_features_value_compatible";`,
  `ALTER TABLE "portfolio"."variant_features" ADD CONSTRAINT "fk_portfolio_variant_features_variantValueId" FOREIGN KEY ("variantValueId") REFERENCES "portfolio"."feature_variants" ("id");`,
  `ALTER TABLE "portfolio"."variant_features" DROP CONSTRAINT IF EXISTS "variant_features_value_exclusive";`,
  `ALTER TABLE "portfolio"."vendable_features" DROP CONSTRAINT IF EXISTS "vendable_features_variant_value_compatible";`,
  `ALTER TABLE "portfolio"."vendable_features" ADD CONSTRAINT "fk_portfolio_vendable_features_variantId" FOREIGN KEY ("variantId") REFERENCES "portfolio"."feature_variants" ("id");`,
  `ALTER TABLE "portfolio"."vendable_features" DROP CONSTRAINT IF EXISTS "vendable_features_value_exclusive";`,
  `ALTER TABLE "portfolio"."feature_variants" DROP CONSTRAINT IF EXISTS "feature_values_id_feature_unique";`,
  `ALTER TABLE "portfolio"."relations" DROP CONSTRAINT IF EXISTS "relations_source_target_type_unique";`,
  `ALTER TABLE "portfolio"."relations" DROP CONSTRAINT IF EXISTS "relations_no_self_reference";`,
  `ALTER TABLE "portfolio"."categories" DROP CONSTRAINT IF EXISTS "categories_no_self_parent";`,
  `CREATE INDEX IF NOT EXISTS "idx_feature_variants_feature" ON "portfolio"."feature_variants" ("featureId");`,
  `CREATE INDEX IF NOT EXISTS "idx_vendable_features_vendable" ON "portfolio"."vendable_features" ("vendableId");`,
  `CREATE INDEX IF NOT EXISTS "idx_portfolio_trans_vendable_lang" ON "portfolio"."translations" ("vendableId", "lang");`,
];

const sqlContent = upStatements.join("\n");
const sqlDown = downStatements.join("\n");

export const migration: Migration = {
  id: "20260925130000_harden_data_integrity",
  content: sqlContent,
  down: sqlDown,
  checksum: computeChecksum(sqlContent),
  resources: [
    "table:portfolio.categories",
    "table:portfolio.relations",
    "table:portfolio.feature_variants",
    "table:portfolio.vendable_features",
    "table:portfolio.variant_features",
    "table:portfolio.variation_groups",
    "table:portfolio.variation_group_features",
    "table:portfolio.proposals",
    "table:portfolio.media_assets",
    "table:portfolio.features",
    "table:portfolio.translations",
    "table:portfolio.variants",
    "table:portfolio.vendables",
  ],
};
