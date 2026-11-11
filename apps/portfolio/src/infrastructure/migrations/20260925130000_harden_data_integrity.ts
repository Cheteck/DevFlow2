import {
  func,
  type Migration,
  type MigrationContext,
} from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM = "4382a17df151274207d5e9240cb815caa4e63ffc7aad23661cb8d01736a00312";
/* checksum:end */

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
  id: "portfolio.catalog.v1.004_harden_data_integrity",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["f757f266afd86eba"],
  resources: [
    // v1.004_harden_data_integrity MODIFIE des tables existantes (ajout contraintes,
    // indexes, colonnes, drop defaults, alter types). R9 exige au moins une
    // ressource déclarée pour la détection de collisions.
    "table:portfolio.categories",
    "table:portfolio.relations",
    "table:portfolio.feature_variants",
    "table:portfolio.vendable_features",
    "table:portfolio.variant_features",
    "table:portfolio.variation_groups",
    "table:portfolio.variation_group_features",
    "table:portfolio.proposals",
    "table:portfolio.media_assets",
    "table:portfolio.vendables",
    "table:portfolio.variants",
  ],
  up: (context: MigrationContext) => {
    context.schema.addConstraint(
      { schema: "portfolio", name: "categories" },
      "categories_no_self_parent",
      'CHECK ("parentId" IS DISTINCT FROM "id")',
    );
    context.schema.addConstraint(
      { schema: "portfolio", name: "relations" },
      "relations_no_self_reference",
      'CHECK ("sourceVendableId" <> "targetVendableId")',
    );
    context.schema.addConstraint(
      { schema: "portfolio", name: "relations" },
      "relations_source_target_type_unique",
      'UNIQUE ("sourceVendableId", "targetVendableId", "relationType")',
    );
    context.schema.addConstraint(
      { schema: "portfolio", name: "feature_variants" },
      "feature_values_id_feature_unique",
      'UNIQUE ("id", "featureId")',
    );
    context.schema.addConstraint(
      { schema: "portfolio", name: "vendable_features" },
      "vendable_features_value_exclusive",
      'CHECK (NOT ("valueText" IS NOT NULL AND "variantId" IS NOT NULL))',
    );
    context.schema.dropConstraint(
      { schema: "portfolio", name: "vendable_features" },
      "fk_portfolio_vendable_features_variantId",
    );
    context.schema.addConstraint(
      { schema: "portfolio", name: "vendable_features" },
      "vendable_features_variant_value_compatible",
      'FOREIGN KEY ("variantId", "featureId") REFERENCES "portfolio"."feature_variants" ("id", "featureId")',
    );
    context.schema.addConstraint(
      { schema: "portfolio", name: "variant_features" },
      "variant_features_value_exclusive",
      'CHECK (NOT ("valueText" IS NOT NULL AND "variantValueId" IS NOT NULL))',
    );
    context.schema.dropConstraint(
      { schema: "portfolio", name: "variant_features" },
      "fk_portfolio_variant_features_variantValueId",
    );
    context.schema.addConstraint(
      { schema: "portfolio", name: "variant_features" },
      "variant_features_value_compatible",
      'FOREIGN KEY ("variantValueId", "featureId") REFERENCES "portfolio"."feature_variants" ("id", "featureId")',
    );
    context.schema.addConstraint(
      { schema: "portfolio", name: "variation_groups" },
      "variation_groups_parent_code_unique",
      'UNIQUE ("parentVendableId", "code")',
    );
    context.schema.addConstraint(
      { schema: "portfolio", name: "variation_group_features" },
      "variation_group_features_unique",
      'UNIQUE ("groupId", "featureId")',
    );
    context.schema.addConstraint(
      { schema: "portfolio", name: "proposals" },
      "proposals_type_check",
      "CHECK (\"type\" IN ('Product', 'Service', 'DigitalProduct', 'Experience'))",
    );
    context.schema.addConstraint(
      { schema: "portfolio", name: "proposals" },
      "proposals_status_check",
      "CHECK (\"status\" IN ('Draft', 'Submitted', 'InReview', 'ChangesRequested', 'Approved', 'Rejected', 'Withdrawn', 'Archived'))",
    );
    context.schema.dropConstraint(
      { schema: "portfolio", name: "proposals" },
      "fk_portfolio_proposals_vendableId",
    );
    context.schema.addConstraint(
      { schema: "portfolio", name: "proposals" },
      "fk_portfolio_proposals_vendableId",
      'FOREIGN KEY ("vendableId") REFERENCES "portfolio"."vendables" ("id") ON DELETE SET NULL',
    );
    context.schema.addConstraint(
      { schema: "portfolio", name: "media_assets" },
      "media_assets_type_check",
      "CHECK (\"type\" IN ('image', 'video', 'pdf', 'document'))",
    );
    context.schema.alterColumnType(
      { schema: "portfolio", name: "media_assets" },
      "url",
      "text",
    );
    context.schema.alterColumnType(
      { schema: "portfolio", name: "translations" },
      "description",
      "text",
    );
    context.schema.alterColumnType(
      { schema: "portfolio", name: "proposals" },
      "platformFeedback",
      "text",
    );
    context.schema.alterColumnType(
      { schema: "portfolio", name: "proposals" },
      "rejectionReason",
      "text",
    );
    context.schema.alterColumnType(
      { schema: "portfolio", name: "features" },
      "description",
      "text",
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "categories" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "feature_groups" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "feature_variants" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "features" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "media_assets" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "proposals" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "proposals" },
      "updatedAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "relations" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "translations" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "variants" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "variants" },
      "updatedAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "variation_groups" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "vendable_features" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "vendables" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "vendables" },
      "updatedAt",
      func("now"),
    );
    context.schema.createFunction(
      "set_updated_at",
      ' BEGIN NEW."updatedAt" = now(); RETURN NEW; END; ',
      {
        schema: "portfolio",
        returns: "TRIGGER",
        language: "plpgsql",
        replace: true,
      },
    );
    context.schema.dropTrigger("trg_vendables_updated_at", "vendables", {
      schema: "portfolio",
    });
    context.schema.createTrigger(
      "trg_vendables_updated_at",
      "vendables",
      ["update"],
      "before",
      "set_updated_at",
      { schema: "portfolio", functionSchema: "portfolio" },
    );
    context.schema.dropTrigger("trg_variants_updated_at", "variants", {
      schema: "portfolio",
    });
    context.schema.createTrigger(
      "trg_variants_updated_at",
      "variants",
      ["update"],
      "before",
      "set_updated_at",
      { schema: "portfolio", functionSchema: "portfolio" },
    );
    context.schema.dropTrigger("trg_proposals_updated_at", "proposals", {
      schema: "portfolio",
    });
    context.schema.createTrigger(
      "trg_proposals_updated_at",
      "proposals",
      ["update"],
      "before",
      "set_updated_at",
      { schema: "portfolio", functionSchema: "portfolio" },
    );
    context.schema.dropIndex("idx_feature_variants_feature", "portfolio");
    context.schema.dropIndex("idx_vendable_features_vendable", "portfolio");
    context.schema.dropIndex("idx_portfolio_trans_vendable_lang", "portfolio");
    context.schema.createIndex(
      { schema: "portfolio", name: "relations" },
      "idx_relations_target",
      [{ name: "targetVendableId" }],
      { ifNotExists: true },
    );
  },
  downMigration: (context: MigrationContext) => {
    context.schema.dropIndex("idx_relations_target", "portfolio");
    context.schema.dropTrigger("trg_proposals_updated_at", "proposals", {
      schema: "portfolio",
    });
    context.schema.dropTrigger("trg_variants_updated_at", "variants", {
      schema: "portfolio",
    });
    context.schema.dropTrigger("trg_vendables_updated_at", "vendables", {
      schema: "portfolio",
    });
    context.schema.dropFunction("set_updated_at", { schema: "portfolio" });
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "vendables" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "vendables" },
      "updatedAt",
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "vendable_features" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "variation_groups" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "variants" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "variants" },
      "updatedAt",
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "translations" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "relations" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "proposals" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "proposals" },
      "updatedAt",
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "media_assets" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "features" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "feature_variants" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "feature_groups" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "portfolio", name: "categories" },
      "createdAt",
    );
    // The rollback restores the historical type: VARCHAR(255).
    context.schema.alterColumnType(
      { schema: "portfolio", name: "features" },
      "description",
      "string",
    );
    context.schema.alterColumnType(
      { schema: "portfolio", name: "proposals" },
      "rejectionReason",
      "string",
    );
    context.schema.alterColumnType(
      { schema: "portfolio", name: "proposals" },
      "platformFeedback",
      "string",
    );
    context.schema.alterColumnType(
      { schema: "portfolio", name: "translations" },
      "description",
      "string",
    );
    context.schema.alterColumnType(
      { schema: "portfolio", name: "media_assets" },
      "url",
      "string",
    );
    context.schema.dropConstraint(
      { schema: "portfolio", name: "media_assets" },
      "media_assets_type_check",
    );
    context.schema.dropConstraint(
      { schema: "portfolio", name: "proposals" },
      "fk_portfolio_proposals_vendableId",
    );
    context.schema.addConstraint(
      { schema: "portfolio", name: "proposals" },
      "fk_portfolio_proposals_vendableId",
      'FOREIGN KEY ("vendableId") REFERENCES "portfolio"."vendables" ("id") ON DELETE CASCADE',
    );
    context.schema.dropConstraint(
      { schema: "portfolio", name: "proposals" },
      "proposals_status_check",
    );
    context.schema.dropConstraint(
      { schema: "portfolio", name: "proposals" },
      "proposals_type_check",
    );
    context.schema.dropConstraint(
      { schema: "portfolio", name: "variation_group_features" },
      "variation_group_features_unique",
    );
    context.schema.dropConstraint(
      { schema: "portfolio", name: "variation_groups" },
      "variation_groups_parent_code_unique",
    );
    context.schema.dropConstraint(
      { schema: "portfolio", name: "variant_features" },
      "variant_features_value_compatible",
    );
    context.schema.addConstraint(
      { schema: "portfolio", name: "variant_features" },
      "fk_portfolio_variant_features_variantValueId",
      'FOREIGN KEY ("variantValueId") REFERENCES "portfolio"."feature_variants" ("id")',
    );
    context.schema.dropConstraint(
      { schema: "portfolio", name: "variant_features" },
      "variant_features_value_exclusive",
    );
    context.schema.dropConstraint(
      { schema: "portfolio", name: "vendable_features" },
      "vendable_features_variant_value_compatible",
    );
    context.schema.addConstraint(
      { schema: "portfolio", name: "vendable_features" },
      "fk_portfolio_vendable_features_variantId",
      'FOREIGN KEY ("variantId") REFERENCES "portfolio"."feature_variants" ("id")',
    );
    context.schema.dropConstraint(
      { schema: "portfolio", name: "vendable_features" },
      "vendable_features_value_exclusive",
    );
    context.schema.dropConstraint(
      { schema: "portfolio", name: "feature_variants" },
      "feature_values_id_feature_unique",
    );
    context.schema.dropConstraint(
      { schema: "portfolio", name: "relations" },
      "relations_source_target_type_unique",
    );
    context.schema.dropConstraint(
      { schema: "portfolio", name: "relations" },
      "relations_no_self_reference",
    );
    context.schema.dropConstraint(
      { schema: "portfolio", name: "categories" },
      "categories_no_self_parent",
    );
    context.schema.createIndex(
      { schema: "portfolio", name: "feature_variants" },
      "idx_feature_variants_feature",
      [{ name: "featureId" }],
      { ifNotExists: true },
    );
    context.schema.createIndex(
      { schema: "portfolio", name: "vendable_features" },
      "idx_vendable_features_vendable",
      [{ name: "vendableId" }],
      { ifNotExists: true },
    );
    context.schema.createIndex(
      { schema: "portfolio", name: "translations" },
      "idx_portfolio_trans_vendable_lang",
      [{ name: "vendableId" }, { name: "lang" }],
      { ifNotExists: true },
    );
  },
};
