import {
  cast,
  column,
  constant,
  equals,
  func,
  isNull,
  notExists,
  select,
  subquery,
  value,
  type Migration,
  type MigrationContext,
} from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM = "325a7fb101c4111f6e61945bb8fdfbe13ddc325e0257c8e2362fe31550eac8d6";
/* checksum:end */

/**
 * portfolio.catalog.v1.005 — PIM normalise : les tables dediees deviennent la
 * source de verite, les colonnes JSON de `vendables` sont supprimees
 * (ADR-0018).
 *
 * - Nouveaux homes normalises : `tags` + `vendable_tags` (pattern categories),
 *   `translation_keywords`, `vendables.slug/metaTitle/metaDesc` (corrige la
 *   perte silencieuse du SEO, jamais persiste avant v1.005).
 * - Backfill explicite de la fiche XIAOMI-18-PRO-MAX-5G (seule ligne existante,
 *   verifiee 1 vs 0 le 2026-10-10) : chaque INSERT est auto-garde (no-op si la
 *   fiche est absente) et idempotent (ON CONFLICT / NOT EXISTS). Sur une base
 *   sans cette fiche, seuls DDL + drops s'appliquent.
 * - Les INSERT reti rent les ids stables (media, variants) et des ids
 *   deterministes (`feat_*`, `fgrp_*`, `fvar_*`, `vf_xiaomi18pm_*`).
 * - Avertissement : toute autre ligne JSON pre-existante sur une base tierce
 *   doit etre basculee avant ce drop (aucune recensee).
 * - Down best-effort : re-creation des colonnes (vides) et suppression des
 *   ajouts — les donnees JSON d'origine ne sont pas restaurees (backup PG
 *   recommande avant application).
 *
 * Postgres-only (comme v1.001-v1.004). Contenu atomique par migration.
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
  id: "portfolio.catalog.v1.005_normalize_pim",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["c75e0d156d1e6f59"],
  resources: [
    // v1.005_normalize_pim CREER des tables dediees (tags, vendable_tags,
    // translation_keywords, vendable_categories, variation_groups,
    // variation_group_features) et MODIFIE des tables existantes
    // (vendables, translations, categories, media_assets, variants, features,
    // feature_groups, feature_variants, vendable_features, variant_features).
    // Seul v1.003_move_to_schema CREATE table:portfolio.vendables et les autres
    // tables portefeuille. Declarer les tables modifiees ici provoquerait des
    // collisions (R9) avec v1.003. On garde seulement les tables CREEES.
    "table:portfolio.tags",
    "table:portfolio.vendable_tags",
    "table:portfolio.translation_keywords",
  ],
  up: (context: MigrationContext) => {
    context.schema.createTable(
      "tags",
      (table) => {
        table.text("id").primary();
        table.text("slug").uniqueInline();
        table.text("name");
        table.text("createdAt").default(func("CURRENT_TIMESTAMP"));
      },
      { ifNotExists: true, schema: "portfolio" },
    );
    context.schema.createTable(
      "vendable_tags",
      (table) => {
        table
          .text("vendableId")
          .references({ schema: "portfolio", name: "vendables" }, "id");
        table
          .text("tagId")
          .references({ schema: "portfolio", name: "tags" }, "id");
        table.uniqueColumns(["vendableId", "tagId"]);
      },
      { ifNotExists: true, schema: "portfolio" },
    );
    context.schema.createIndex(
      { schema: "portfolio", name: "vendable_tags" },
      "idx_vendable_tags_tag",
      [{ name: "tagId" }],
      { ifNotExists: true },
    );
    context.schema.createTable(
      "translation_keywords",
      (table) => {
        table
          .text("vendableId")
          .references({ schema: "portfolio", name: "vendables" }, "id");
        table.text("lang");
        table.text("keyword");
        table.uniqueColumns(["vendableId", "lang", "keyword"]);
      },
      { ifNotExists: true, schema: "portfolio" },
    );
    context.schema.addColumn(
      { schema: "portfolio", name: "vendables" },
      "slug",
      "text",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true },
    );
    context.schema.addColumn(
      { schema: "portfolio", name: "vendables" },
      "metaTitle",
      "text",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true },
    );
    context.schema.addColumn(
      { schema: "portfolio", name: "vendables" },
      "metaDesc",
      "text",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true },
    );
    context.data.insert(
      { schema: "portfolio", name: "feature_groups" },
      {
        id: "fgrp_attributes",
        code: "attributes",
        name: "Attributs descriptifs",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insert(
      { schema: "portfolio", name: "feature_groups" },
      {
        id: "fgrp_attr_options",
        code: "attr:options",
        name: "Bloc options",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insert(
      { schema: "portfolio", name: "feature_groups" },
      {
        id: "fgrp_variant",
        code: "variant",
        name: "Attributs de declinaison",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insert(
      { schema: "portfolio", name: "feature_groups" },
      {
        id: "fgrp_spec_body",
        code: "spec:body",
        name: "Specifications body",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insert(
      { schema: "portfolio", name: "feature_groups" },
      {
        id: "fgrp_spec_misc",
        code: "spec:misc",
        name: "Specifications misc",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insert(
      { schema: "portfolio", name: "feature_groups" },
      {
        id: "fgrp_spec_comms",
        code: "spec:comms",
        name: "Specifications comms",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insert(
      { schema: "portfolio", name: "feature_groups" },
      {
        id: "fgrp_spec_sound",
        code: "spec:sound",
        name: "Specifications sound",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insert(
      { schema: "portfolio", name: "feature_groups" },
      {
        id: "fgrp_spec_launch",
        code: "spec:launch",
        name: "Specifications launch",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insert(
      { schema: "portfolio", name: "feature_groups" },
      {
        id: "fgrp_spec_memory",
        code: "spec:memory",
        name: "Specifications memory",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insert(
      { schema: "portfolio", name: "feature_groups" },
      {
        id: "fgrp_spec_battery",
        code: "spec:battery",
        name: "Specifications battery",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insert(
      { schema: "portfolio", name: "feature_groups" },
      {
        id: "fgrp_spec_network",
        code: "spec:network",
        name: "Specifications network",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insert(
      { schema: "portfolio", name: "feature_groups" },
      {
        id: "fgrp_spec_features",
        code: "spec:features",
        name: "Specifications features",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insert(
      { schema: "portfolio", name: "feature_groups" },
      {
        id: "fgrp_spec_platform",
        code: "spec:platform",
        name: "Specifications platform",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insert(
      { schema: "portfolio", name: "feature_groups" },
      {
        id: "fgrp_spec_camera_main",
        code: "spec:camera_main",
        name: "Specifications camera_main",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insert(
      { schema: "portfolio", name: "feature_groups" },
      {
        id: "fgrp_spec_camera_video",
        code: "spec:camera_video",
        name: "Specifications camera_video",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insert(
      { schema: "portfolio", name: "feature_groups" },
      {
        id: "fgrp_spec_display_main",
        code: "spec:display_main",
        name: "Specifications display_main",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insert(
      { schema: "portfolio", name: "feature_groups" },
      {
        id: "fgrp_spec_camera_selfie",
        code: "spec:camera_selfie",
        name: "Specifications camera_selfie",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insert(
      { schema: "portfolio", name: "feature_groups" },
      {
        id: "fgrp_spec_display_secondary",
        code: "spec:display_secondary",
        name: "Specifications display_secondary",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_os"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("os"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("os"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_cpu"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("cpu"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("cpu"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_gpu"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("gpu"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("gpu"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_sim"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("sim"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("sim"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_brand"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("brand"),
          value("T"),
          value("brand"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("brand"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_build"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("build"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("build"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_model"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("model"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("model"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_weight"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("weight"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("weight"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_chipset"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("chipset"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("chipset"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_options_color_label"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attr:options"))],
            }),
          ),
          value("options.color.label"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.color.label"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_options_color_source"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attr:options"))],
            }),
          ),
          value("options.color.source"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.color.source"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_options_color_values"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attr:options"))],
            }),
          ),
          value("options.color.values"),
          value("E"),
          value("multivalue"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.color.values"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_options_color_modeling"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attr:options"))],
            }),
          ),
          value("options.color.modeling"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.color.modeling"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_options_weight_note"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attr:options"))],
            }),
          ),
          value("options.weight.note"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.weight.note"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_options_weight_label"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attr:options"))],
            }),
          ),
          value("options.weight.label"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.weight.label"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_options_weight_source"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attr:options"))],
            }),
          ),
          value("options.weight.source"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.weight.source"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_options_weight_values"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attr:options"))],
            }),
          ),
          value("options.weight.values"),
          value("E"),
          value("multivalue"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.weight.values"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_options_storage_ram_label"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attr:options"))],
            }),
          ),
          value("options.storage_ram.label"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.storage_ram.label"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_options_storage_ram_source"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attr:options"))],
            }),
          ),
          value("options.storage_ram.source"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.storage_ram.source"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_options_storage_ram_values"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attr:options"))],
            }),
          ),
          value("options.storage_ram.values"),
          value("E"),
          value("multivalue"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.storage_ram.values"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_options_storage_ram_modeling"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attr:options"))],
            }),
          ),
          value("options.storage_ram.modeling"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.storage_ram.modeling"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_material"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("material"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("material"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_source_url"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("source_url"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("source_url"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_battery_mah"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("battery_mAh"),
          value("N"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("battery_mAh"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_storage_type"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("storage_type"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("storage_type"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_charging_wired_w"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("charging_wired_w"),
          value("N"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("charging_wired_w"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_water_resistance"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("water_resistance"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("water_resistance"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_display_size_inch"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("display_size_inch"),
          value("N"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_size_inch"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_secondary_display"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("secondary_display"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("secondary_display"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_source_fetched_at"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("source_fetched_at"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("source_fetched_at"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_display_refresh_hz"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("display_refresh_hz"),
          value("N"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_refresh_hz"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_charging_wireless_w"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("charging_wireless_w"),
          value("N"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("charging_wireless_w"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_charging_reverse_wireless_w"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("attributes"))],
            }),
          ),
          value("charging_reverse_wireless_w"),
          value("N"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("charging_reverse_wireless_w"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_body_sim"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:body"))],
            }),
          ),
          value("body.sim"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("body.sim"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_body_build"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:body"))],
            }),
          ),
          value("body.build"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("body.build"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_body_weight"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:body"))],
            }),
          ),
          value("body.weight"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("body.weight"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_body_dimensions_mm"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:body"))],
            }),
          ),
          value("body.dimensions_mm"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("body.dimensions_mm"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_misc_colors"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:misc"))],
            }),
          ),
          value("misc.colors"),
          value("E"),
          value("multivalue"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("misc.colors"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_misc_models"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:misc"))],
            }),
          ),
          value("misc.models"),
          value("E"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("misc.models"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_comms_nfc"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:comms"))],
            }),
          ),
          value("comms.nfc"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("comms.nfc"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_comms_usb"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:comms"))],
            }),
          ),
          value("comms.usb"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("comms.usb"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_comms_wlan"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:comms"))],
            }),
          ),
          value("comms.wlan"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("comms.wlan"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_comms_infrared"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:comms"))],
            }),
          ),
          value("comms.infrared"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("comms.infrared"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_comms_radio_fm"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:comms"))],
            }),
          ),
          value("comms.radio_fm"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("comms.radio_fm"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_comms_bluetooth"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:comms"))],
            }),
          ),
          value("comms.bluetooth"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("comms.bluetooth"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_comms_positioning"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:comms"))],
            }),
          ),
          value("comms.positioning"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("comms.positioning"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_sound_quality"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:sound"))],
            }),
          ),
          value("sound.quality"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("sound.quality"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_sound_jack_3_5mm"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:sound"))],
            }),
          ),
          value("sound.jack_3_5mm"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("sound.jack_3_5mm"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_sound_loudspeaker"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:sound"))],
            }),
          ),
          value("sound.loudspeaker"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("sound.loudspeaker"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_launch_status"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:launch"))],
            }),
          ),
          value("launch.status"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("launch.status"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_launch_announced"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:launch"))],
            }),
          ),
          value("launch.announced"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("launch.announced"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_memory_type"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:memory"))],
            }),
          ),
          value("memory.type"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("memory.type"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_memory_options"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:memory"))],
            }),
          ),
          value("memory.options"),
          value("E"),
          value("multivalue"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("memory.options"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_memory_card_slot"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:memory"))],
            }),
          ),
          value("memory.card_slot"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("memory.card_slot"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_battery_type"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:battery"))],
            }),
          ),
          value("battery.type"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("battery.type"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_battery_charging"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:battery"))],
            }),
          ),
          value("battery.charging"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("battery.charging"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_network_speed"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:network"))],
            }),
          ),
          value("network.speed"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("network.speed"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_network_bands_2g"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:network"))],
            }),
          ),
          value("network.bands_2g"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("network.bands_2g"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_network_bands_3g"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:network"))],
            }),
          ),
          value("network.bands_3g"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("network.bands_3g"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_network_bands_4g"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:network"))],
            }),
          ),
          value("network.bands_4g"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("network.bands_4g"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_network_bands_5g"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:network"))],
            }),
          ),
          value("network.bands_5g"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("network.bands_5g"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_network_technology"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:network"))],
            }),
          ),
          value("network.technology"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("network.technology"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_features_uwb"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:features"))],
            }),
          ),
          value("features.uwb"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("features.uwb"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_features_sensors"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:features"))],
            }),
          ),
          value("features.sensors"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("features.sensors"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_platform_os"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:platform"))],
            }),
          ),
          value("platform.os"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("platform.os"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_platform_cpu"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:platform"))],
            }),
          ),
          value("platform.cpu"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("platform.cpu"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_platform_gpu"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:platform"))],
            }),
          ),
          value("platform.gpu"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("platform.gpu"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_platform_chipset"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:platform"))],
            }),
          ),
          value("platform.chipset"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("platform.chipset"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_camera_main_wide"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:camera_main"))],
            }),
          ),
          value("camera_main.wide"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("camera_main.wide"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_camera_main_features"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:camera_main"))],
            }),
          ),
          value("camera_main.features"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("camera_main.features"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_camera_main_telephoto"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:camera_main"))],
            }),
          ),
          value("camera_main.telephoto"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("camera_main.telephoto"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_camera_main_ultrawide"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:camera_main"))],
            }),
          ),
          value("camera_main.ultrawide"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("camera_main.ultrawide"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_camera_video"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:camera_video"))],
            }),
          ),
          value("camera_video"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("camera_video"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_display_main_size"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:display_main"))],
            }),
          ),
          value("display_main.size"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_main.size"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_display_main_type"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:display_main"))],
            }),
          ),
          value("display_main.type"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_main.type"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_display_main_features"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:display_main"))],
            }),
          ),
          value("display_main.features"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_main.features"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_display_main_protection"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:display_main"))],
            }),
          ),
          value("display_main.protection"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_main.protection"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_display_main_refresh_hz"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:display_main"))],
            }),
          ),
          value("display_main.refresh_hz"),
          value("N"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_main.refresh_hz"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_display_main_resolution"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:display_main"))],
            }),
          ),
          value("display_main.resolution"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_main.resolution"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_display_main_brightness_peak_nits"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:display_main"))],
            }),
          ),
          value("display_main.brightness_peak_nits"),
          value("N"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [
                equals("code", value("display_main.brightness_peak_nits")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_camera_selfie_video"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:camera_selfie"))],
            }),
          ),
          value("camera_selfie.video"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("camera_selfie.video"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_camera_selfie_sensor"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:camera_selfie"))],
            }),
          ),
          value("camera_selfie.sensor"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("camera_selfie.sensor"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_display_secondary_size"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:display_secondary"))],
            }),
          ),
          value("display_secondary.size"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_secondary.size"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_display_secondary_type"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:display_secondary"))],
            }),
          ),
          value("display_secondary.type"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_secondary.type"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_display_secondary_refresh_hz"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:display_secondary"))],
            }),
          ),
          value("display_secondary.refresh_hz"),
          value("N"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_secondary.refresh_hz"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_display_secondary_resolution"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:display_secondary"))],
            }),
          ),
          value("display_secondary.resolution"),
          value("T"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_secondary.resolution"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_display_secondary_brightness_peak_nits"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("spec:display_secondary"))],
            }),
          ),
          value("display_secondary.brightness_peak_nits"),
          value("N"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [
                equals("code", value("display_secondary.brightness_peak_nits")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_storage_gb"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("variant"))],
            }),
          ),
          value("storage_gb"),
          value("N"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("storage_gb"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "features" },
      ["id", "groupId", "code", "featureType", "purpose", "createdAt"],
      select({
        columns: [
          value("feat_ram_gb"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_groups" },
              where: [equals("code", value("variant"))],
            }),
          ),
          value("ram_gb"),
          value("N"),
          value("additional"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("ram_gb"))],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_options_color_values_black"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.color.values"))],
            }),
          ),
          value("Black"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("options.color.values"))],
                    }),
                  ),
                ),
                equals("variant", value("Black")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_options_color_values_white"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.color.values"))],
            }),
          ),
          value("White"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("options.color.values"))],
                    }),
                  ),
                ),
                equals("variant", value("White")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_options_color_values_pink"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.color.values"))],
            }),
          ),
          value("Pink"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("options.color.values"))],
                    }),
                  ),
                ),
                equals("variant", value("Pink")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_options_color_values_red"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.color.values"))],
            }),
          ),
          value("Red"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("options.color.values"))],
                    }),
                  ),
                ),
                equals("variant", value("Red")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_options_color_values_blue"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.color.values"))],
            }),
          ),
          value("Blue"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("options.color.values"))],
                    }),
                  ),
                ),
                equals("variant", value("Blue")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_options_weight_values_235_g"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.weight.values"))],
            }),
          ),
          value("235 g"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("options.weight.values"))],
                    }),
                  ),
                ),
                equals("variant", value("235 g")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_options_weight_values_240_g"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.weight.values"))],
            }),
          ),
          value("240 g"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("options.weight.values"))],
                    }),
                  ),
                ),
                equals("variant", value("240 g")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_options_storage_ram_values_256gb_12gb_ram"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.storage_ram.values"))],
            }),
          ),
          value("256GB 12GB RAM"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [
                        equals("code", value("options.storage_ram.values")),
                      ],
                    }),
                  ),
                ),
                equals("variant", value("256GB 12GB RAM")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_options_storage_ram_values_512gb_12gb_ram"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.storage_ram.values"))],
            }),
          ),
          value("512GB 12GB RAM"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [
                        equals("code", value("options.storage_ram.values")),
                      ],
                    }),
                  ),
                ),
                equals("variant", value("512GB 12GB RAM")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_options_storage_ram_values_512gb_16gb_ram"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.storage_ram.values"))],
            }),
          ),
          value("512GB 16GB RAM"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [
                        equals("code", value("options.storage_ram.values")),
                      ],
                    }),
                  ),
                ),
                equals("variant", value("512GB 16GB RAM")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_options_storage_ram_values_1tb_16gb_ram"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.storage_ram.values"))],
            }),
          ),
          value("1TB 16GB RAM"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [
                        equals("code", value("options.storage_ram.values")),
                      ],
                    }),
                  ),
                ),
                equals("variant", value("1TB 16GB RAM")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_misc_colors_black"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("misc.colors"))],
            }),
          ),
          value("Black"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("misc.colors"))],
                    }),
                  ),
                ),
                equals("variant", value("Black")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_misc_colors_white"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("misc.colors"))],
            }),
          ),
          value("White"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("misc.colors"))],
                    }),
                  ),
                ),
                equals("variant", value("White")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_misc_colors_pink"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("misc.colors"))],
            }),
          ),
          value("Pink"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("misc.colors"))],
                    }),
                  ),
                ),
                equals("variant", value("Pink")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_misc_colors_red"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("misc.colors"))],
            }),
          ),
          value("Red"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("misc.colors"))],
                    }),
                  ),
                ),
                equals("variant", value("Red")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_misc_colors_blue"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("misc.colors"))],
            }),
          ),
          value("Blue"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("misc.colors"))],
                    }),
                  ),
                ),
                equals("variant", value("Blue")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_misc_models_2611fpnfag"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("misc.models"))],
            }),
          ),
          value("2611FPNFAG"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("misc.models"))],
                    }),
                  ),
                ),
                equals("variant", value("2611FPNFAG")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_memory_options_256gb_12gb_ram"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("memory.options"))],
            }),
          ),
          value("256GB 12GB RAM"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("memory.options"))],
                    }),
                  ),
                ),
                equals("variant", value("256GB 12GB RAM")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_memory_options_512gb_12gb_ram"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("memory.options"))],
            }),
          ),
          value("512GB 12GB RAM"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("memory.options"))],
                    }),
                  ),
                ),
                equals("variant", value("512GB 12GB RAM")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_memory_options_512gb_16gb_ram"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("memory.options"))],
            }),
          ),
          value("512GB 16GB RAM"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("memory.options"))],
                    }),
                  ),
                ),
                equals("variant", value("512GB 16GB RAM")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "feature_variants" },
      ["id", "featureId", "variant", "createdAt"],
      select({
        columns: [
          value("fvar_memory_options_1tb_16gb_ram"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("memory.options"))],
            }),
          ),
          value("1TB 16GB RAM"),
          func("now"),
        ],
        where: [
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("memory.options"))],
                    }),
                  ),
                ),
                equals("variant", value("1TB 16GB RAM")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__os"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("os"))],
            }),
          ),
          value("Android 17, HyperOS 4"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("os"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__cpu"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("cpu"))],
            }),
          ),
          value("Octa-core 2x5.01 GHz Prime + 3x4.03 GHz + 3x3.74 GHz"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("cpu"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__gpu"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("gpu"))],
            }),
          ),
          value("Adreno 850"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("gpu"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__sim"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("sim"))],
            }),
          ),
          value("Nano-SIM + Nano-SIM"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("sim"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__brand"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("brand"))],
            }),
          ),
          value("Xiaomi"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("brand"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__build"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("build"))],
            }),
          ),
          value("Vitre avant Dragon Crystal Glass 3, cadre aluminium"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("build"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__model"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("model"))],
            }),
          ),
          value("2611FPNFAG"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("model"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__weight"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("weight"))],
            }),
          ),
          value("235 g ou 240 g"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("weight"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__chipset"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("chipset"))],
            }),
          ),
          value("Qualcomm SM8975 Snapdragon 8 Elite Extreme Gen 6 (2 nm)"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("chipset"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__options_color_label"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.color.label"))],
            }),
          ),
          value("Coloris"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("options.color.label"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__options_color_source"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.color.source"))],
            }),
          ),
          value("gsmarena:Misc/Colors"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("options.color.source"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__options_color_values"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.color.values"))],
            }),
          ),
          value("Black, White, Pink, Red, Blue"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("options.color.values"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__options_color_modeling"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.color.modeling"))],
            }),
          ),
          value("options (aucun SKU par coloris sur la source)"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("options.color.modeling"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__options_weight_note"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.weight.note"))],
            }),
          ),
          value(
            "Le critere distinguant les deux poids n'est pas precise sur la fiche source — non modelise en variantes.",
          ),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("options.weight.note"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__options_weight_label"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.weight.label"))],
            }),
          ),
          value("Poids"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("options.weight.label"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__options_weight_source"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.weight.source"))],
            }),
          ),
          value("gsmarena:Body/Weight"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("options.weight.source"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__options_weight_values"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.weight.values"))],
            }),
          ),
          value("235 g, 240 g"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("options.weight.values"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__options_storage_ram_label"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.storage_ram.label"))],
            }),
          ),
          value("Stockage / RAM"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [
                        equals("code", value("options.storage_ram.label")),
                      ],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__options_storage_ram_source"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.storage_ram.source"))],
            }),
          ),
          value("gsmarena:Memory/Internal"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [
                        equals("code", value("options.storage_ram.source")),
                      ],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__options_storage_ram_values"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.storage_ram.values"))],
            }),
          ),
          value("256GB 12GB RAM, 512GB 12GB RAM, 512GB 16GB RAM, 1TB 16GB RAM"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [
                        equals("code", value("options.storage_ram.values")),
                      ],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__options_storage_ram_modeling"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("options.storage_ram.modeling"))],
            }),
          ),
          value("variantes (SKU dedies)"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [
                        equals("code", value("options.storage_ram.modeling")),
                      ],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__material"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("material"))],
            }),
          ),
          value("glass_front_aluminum_frame"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("material"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__source_url"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("source_url"))],
            }),
          ),
          value("https://www.gsmarena.com/xiaomi_18_pro_max_5g-14958.php"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("source_url"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__battery_mah"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("battery_mAh"))],
            }),
          ),
          value("8500"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("battery_mAh"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__storage_type"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("storage_type"))],
            }),
          ),
          value("UFS 4.1"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("storage_type"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__charging_wired_w"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("charging_wired_w"))],
            }),
          ),
          value("100"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("charging_wired_w"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__water_resistance"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("water_resistance"))],
            }),
          ),
          value("IP68 (6 m, 30 min)"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("water_resistance"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__display_size_inch"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_size_inch"))],
            }),
          ),
          value("6.9"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("display_size_inch"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__secondary_display"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("secondary_display"))],
            }),
          ),
          value("AMOLED 2.9 pouces au dos, 120 Hz, 4000 nits"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("secondary_display"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__source_fetched_at"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("source_fetched_at"))],
            }),
          ),
          value("2026-10-10T01:51:27.422Z"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("source_fetched_at"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__display_refresh_hz"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_refresh_hz"))],
            }),
          ),
          value("120"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("display_refresh_hz"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__charging_wireless_w"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("charging_wireless_w"))],
            }),
          ),
          value("50"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("charging_wireless_w"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__charging_reverse_wireless_w"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("charging_reverse_wireless_w"))],
            }),
          ),
          value("27"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [
                        equals("code", value("charging_reverse_wireless_w")),
                      ],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__body_sim"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("body.sim"))],
            }),
          ),
          value(
            "Nano-SIM + Nano-SIM, IP68 (poussi�re + eau jusqu'� 6 m pendant 30 min)",
          ),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("body.sim"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__body_build"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("body.build"))],
            }),
          ),
          value("Vitre avant (Dragon Crystal Glass 3), cadre aluminium"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("body.build"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__body_weight"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("body.weight"))],
            }),
          ),
          value("235 g ou 240 g"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("body.weight"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__body_dimensions_mm"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("body.dimensions_mm"))],
            }),
          ),
          value("163.4 x 77.6 x 8.4"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("body.dimensions_mm"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__misc_colors"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("misc.colors"))],
            }),
          ),
          value("Black, White, Pink, Red, Blue"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("misc.colors"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "variantId", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__misc_models"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("misc.models"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "feature_variants" },
              where: [
                equals(
                  "featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("misc.models"))],
                    }),
                  ),
                ),
                equals("variant", value("2611FPNFAG")),
              ],
            }),
          ),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("misc.models"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__comms_nfc"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("comms.nfc"))],
            }),
          ),
          value("Oui"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("comms.nfc"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__comms_usb"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("comms.usb"))],
            }),
          ),
          value("USB Type-C 3.2, DisplayPort, OTG"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("comms.usb"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__comms_wlan"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("comms.wlan"))],
            }),
          ),
          value("Wi-Fi 802.11 a/b/g/n/ac/6e/7, dual-band, Wi-Fi Direct"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("comms.wlan"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__comms_infrared"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("comms.infrared"))],
            }),
          ),
          value("Oui"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("comms.infrared"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__comms_radio_fm"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("comms.radio_fm"))],
            }),
          ),
          value("Non"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("comms.radio_fm"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__comms_bluetooth"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("comms.bluetooth"))],
            }),
          ),
          value("6.0, A2DP, LE, aptX HD/Adaptive, LHDC 5"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("comms.bluetooth"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__comms_positioning"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("comms.positioning"))],
            }),
          ),
          value("GPS (L1+L5), BDS, GALILEO, QZSS, NavIC, GLONASS"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("comms.positioning"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__sound_quality"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("sound.quality"))],
            }),
          ),
          value("Audio Hi-Res 24-bit/192 kHz + sans fil, Snapdragon Sound"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("sound.quality"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__sound_jack_3_5mm"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("sound.jack_3_5mm"))],
            }),
          ),
          value("Non"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("sound.jack_3_5mm"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__sound_loudspeaker"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("sound.loudspeaker"))],
            }),
          ),
          value("Oui, st�r�o (3 haut-parleurs, Dolby Atmos)"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("sound.loudspeaker"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__launch_status"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("launch.status"))],
            }),
          ),
          value("Disponible depuis le 2026-09-23"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("launch.status"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__launch_announced"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("launch.announced"))],
            }),
          ),
          value("2026-09-23"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("launch.announced"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__memory_type"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("memory.type"))],
            }),
          ),
          value("UFS 4.1"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("memory.type"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__memory_options"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("memory.options"))],
            }),
          ),
          value("256GB 12GB RAM, 512GB 12GB RAM, 512GB 16GB RAM, 1TB 16GB RAM"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("memory.options"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__memory_card_slot"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("memory.card_slot"))],
            }),
          ),
          value("Non"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("memory.card_slot"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__battery_type"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("battery.type"))],
            }),
          ),
          value("Si/C Li-Ion 8500 mAh"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("battery.type"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__battery_charging"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("battery.charging"))],
            }),
          ),
          value(
            "100W filaire PD3.0 QC3+ PPS, 50W sans fil, 27W invers�e sans fil",
          ),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("battery.charging"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__network_speed"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("network.speed"))],
            }),
          ),
          value("HSPA, LTE, 5G"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("network.speed"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__network_bands_2g"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("network.bands_2g"))],
            }),
          ),
          value("GSM 850/900/1800/1900"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("network.bands_2g"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__network_bands_3g"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("network.bands_3g"))],
            }),
          ),
          value("HSDPA 800/850/900/1700/1900/2100"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("network.bands_3g"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__network_bands_4g"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("network.bands_4g"))],
            }),
          ),
          value(
            "1, 2, 3, 4, 5, 7, 8, 12, 13, 14, 17, 18, 19, 20, 25, 26, 28, 29, 34, 38, 39, 40, 41, 42, 43, 48, 66, 71",
          ),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("network.bands_4g"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__network_bands_5g"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("network.bands_5g"))],
            }),
          ),
          value(
            "1, 2, 3, 5, 7, 8, 12, 13, 14, 18, 20, 25, 26, 28, 29, 38, 40, 41, 48, 66, 70, 71, 77, 78, 79, 80, 81, 83, 84, 89 (SA/NSA)",
          ),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("network.bands_5g"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__network_technology"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("network.technology"))],
            }),
          ),
          value("GSM / HSPA / LTE / 5G"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("network.technology"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__features_uwb"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("features.uwb"))],
            }),
          ),
          value("Prise en charge Ultra Wideband (UWB)"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("features.uwb"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__features_sensors"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("features.sensors"))],
            }),
          ),
          value(
            "Empreinte sous �cran (ultrasons), acc�l�rom�tre, proximit�, gyroscope, boussole, barom�tre",
          ),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("features.sensors"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__platform_os"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("platform.os"))],
            }),
          ),
          value("Android 17, HyperOS 4"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("platform.os"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__platform_cpu"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("platform.cpu"))],
            }),
          ),
          value("Octa-core (2x5.01 GHz Prime + 3x4.03 GHz + 3x3.74 GHz)"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("platform.cpu"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__platform_gpu"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("platform.gpu"))],
            }),
          ),
          value("Adreno 850"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("platform.gpu"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__platform_chipset"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("platform.chipset"))],
            }),
          ),
          value("Qualcomm SM8975 Snapdragon 8 Elite Extreme Gen 6 (2 nm)"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("platform.chipset"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__camera_main_wide"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("camera_main.wide"))],
            }),
          ),
          value("200 MP f/1.7 23 mm 1/1.28 pouce, dual pixel PDAF, OIS"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("camera_main.wide"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__camera_main_features"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("camera_main.features"))],
            }),
          ),
          value(
            "Laser AF, capteur spectral, optique Leica, flash Dual-LED, HDR, panorama",
          ),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("camera_main.features"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__camera_main_telephoto"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("camera_main.telephoto"))],
            }),
          ),
          value(
            "200 MP f/2.4 75 mm p�riscope 1/1.56 pouce, PDAF, OIS, zoom optique x3.2",
          ),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("camera_main.telephoto"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__camera_main_ultrawide"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("camera_main.ultrawide"))],
            }),
          ),
          value("50 MP f/2.4 17 mm 102 degr�s 1/2.88 pouce, PDAF"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("camera_main.ultrawide"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__camera_video"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("camera_video"))],
            }),
          ),
          value(
            "8K@30 (HDR), 4K@30/60/120 (HDR10+, Dolby Vision 10-bit, LOG), 1080p jusqu'� 960fps, 720p@1920fps, gyro-EIS",
          ),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("camera_video"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__display_main_size"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_main.size"))],
            }),
          ),
          value("6.9 pouces, ~91.6% ratio �cran"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("display_main.size"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__display_main_type"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_main.type"))],
            }),
          ),
          value("LTPO AMOLED"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("display_main.type"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__display_main_features"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_main.features"))],
            }),
          ),
          value(
            "68B couleurs, 2160 Hz PWM, Dolby Vision, HDR Vivid, HDR10+, BT.2020",
          ),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("display_main.features"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__display_main_protection"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_main.protection"))],
            }),
          ),
          value("Xiaomi Dragon Crystal Glass 3"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("display_main.protection"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__display_main_refresh_hz"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_main.refresh_hz"))],
            }),
          ),
          value("120"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("display_main.refresh_hz"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__display_main_resolution"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_main.resolution"))],
            }),
          ),
          value("1208 x 2624 pixels, ratio 19.5:9 (~418 ppi)"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("display_main.resolution"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__display_main_brightness_peak_nits"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [
                equals("code", value("display_main.brightness_peak_nits")),
              ],
            }),
          ),
          value("4000"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [
                        equals(
                          "code",
                          value("display_main.brightness_peak_nits"),
                        ),
                      ],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__camera_selfie_video"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("camera_selfie.video"))],
            }),
          ),
          value("4K@30/60, 1080p@30/60, HDR10+, gyro-EIS"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("camera_selfie.video"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__camera_selfie_sensor"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("camera_selfie.sensor"))],
            }),
          ),
          value("50 MP f/2.2 21 mm 1/2.88 pouce, PDAF"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("camera_selfie.sensor"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__display_secondary_size"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_secondary.size"))],
            }),
          ),
          value("2.9 pouces (dos)"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("display_secondary.size"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__display_secondary_type"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_secondary.type"))],
            }),
          ),
          value("LTPO AMOLED, Dolby Vision, HDR Vivid, HDR10+, BT.2020"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("display_secondary.type"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__display_secondary_refresh_hz"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_secondary.refresh_hz"))],
            }),
          ),
          value("120"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [
                        equals("code", value("display_secondary.refresh_hz")),
                      ],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__display_secondary_resolution"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("display_secondary.resolution"))],
            }),
          ),
          value("596 x 976 pixels"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [
                        equals("code", value("display_secondary.resolution")),
                      ],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_features" },
      ["id", "vendableId", "featureId", "valueText", "createdAt"],
      select({
        columns: [
          value("vf_xiaomi18pm__display_secondary_brightness_peak_nits"),
          subquery(
            select({
              columns: [column("v.id")],
              from: { schema: "portfolio", name: "vendables", alias: "v" },
              where: [equals("v.reference", value("XIAOMI-18-PRO-MAX-5G"))],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [
                equals("code", value("display_secondary.brightness_peak_nits")),
              ],
            }),
          ),
          value("4000"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [
                        equals(
                          "code",
                          value("display_secondary.brightness_peak_nits"),
                        ),
                      ],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "translations" },
      [
        "id",
        "vendableId",
        "lang",
        "name",
        "shortDescription",
        "description",
        "createdAt",
      ],
      select({
        columns: [
          value("tr_xiaomi18pm_fr"),
          column("v.id"),
          value("fr"),
          value("Xiaomi 18 Pro Max 5G"),
          value(
            "Smartphone flagship Xiaomi 18 Pro Max 5G (2026) : �cran LTPO AMOLED 6,9 pouces 120 Hz (1208x2624, 4000 nits) plus �cran AMOLED 2,9 pouces au dos, Snapdragon 8 E",
          ),
          value(
            "Smartphone flagship Xiaomi 18 Pro Max 5G (2026) : �cran LTPO AMOLED 6,9 pouces 120 Hz (1208x2624, 4000 nits) plus �cran AMOLED 2,9 pouces au dos, Snapdragon 8 Elite Extreme Gen 6 (2 nm), jusqu'� 16 Go de RAM et 1 To en UFS 4.1, triple capteur Leica 200+200+50 MP avec t�l�objectif p�riscopique x3,2 stabilis�, selfie 50 MP, batterie Si/C 8500 mAh (100 W filaire, 50 W sans fil, 27 W invers�e), Android 17 HyperOS 4, IP68, 235 g. Fiche descriptive PIM : d�clinaisons m�moire en variantes, sans prix ni disponibilit�.",
          ),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "translations", alias: "x" },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals("x.lang", value("fr")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insert(
      { schema: "portfolio", name: "categories" },
      {
        id: "cat_smartphones",
        slug: "smartphones",
        name: "Smartphones",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_categories" },
      ["vendableId", "categoryId"],
      select({
        columns: [
          column("v.id"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "categories" },
              where: [equals("slug", value("smartphones"))],
            }),
          ),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "vendable_categories",
                alias: "x",
              },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insert(
      { schema: "portfolio", name: "tags" },
      {
        id: "tag_xiaomi",
        slug: "xiaomi",
        name: "xiaomi",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_tags" },
      ["vendableId", "tagId"],
      select({
        columns: [
          column("v.id"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "tags" },
              where: [equals("slug", value("xiaomi"))],
            }),
          ),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "vendable_tags", alias: "x" },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insert(
      { schema: "portfolio", name: "tags" },
      {
        id: "tag_smartphone",
        slug: "smartphone",
        name: "smartphone",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_tags" },
      ["vendableId", "tagId"],
      select({
        columns: [
          column("v.id"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "tags" },
              where: [equals("slug", value("smartphone"))],
            }),
          ),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "vendable_tags", alias: "x" },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insert(
      { schema: "portfolio", name: "tags" },
      { id: "tag_5g", slug: "5g", name: "5g", createdAt: func("now") },
      { onConflictIgnore: true },
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_tags" },
      ["vendableId", "tagId"],
      select({
        columns: [
          column("v.id"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "tags" },
              where: [equals("slug", value("5g"))],
            }),
          ),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "vendable_tags", alias: "x" },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insert(
      { schema: "portfolio", name: "tags" },
      {
        id: "tag_amoled",
        slug: "amoled",
        name: "amoled",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_tags" },
      ["vendableId", "tagId"],
      select({
        columns: [
          column("v.id"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "tags" },
              where: [equals("slug", value("amoled"))],
            }),
          ),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "vendable_tags", alias: "x" },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insert(
      { schema: "portfolio", name: "tags" },
      {
        id: "tag_snapdragon_8_elite",
        slug: "snapdragon-8-elite",
        name: "snapdragon-8-elite",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_tags" },
      ["vendableId", "tagId"],
      select({
        columns: [
          column("v.id"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "tags" },
              where: [equals("slug", value("snapdragon-8-elite"))],
            }),
          ),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "vendable_tags", alias: "x" },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insert(
      { schema: "portfolio", name: "tags" },
      { id: "tag_ip68", slug: "ip68", name: "ip68", createdAt: func("now") },
      { onConflictIgnore: true },
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_tags" },
      ["vendableId", "tagId"],
      select({
        columns: [
          column("v.id"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "tags" },
              where: [equals("slug", value("ip68"))],
            }),
          ),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "vendable_tags", alias: "x" },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insert(
      { schema: "portfolio", name: "tags" },
      {
        id: "tag_flagship",
        slug: "flagship",
        name: "flagship",
        createdAt: func("now"),
      },
      { onConflictIgnore: true },
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_tags" },
      ["vendableId", "tagId"],
      select({
        columns: [
          column("v.id"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "tags" },
              where: [equals("slug", value("flagship"))],
            }),
          ),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "vendable_tags", alias: "x" },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insert(
      { schema: "portfolio", name: "tags" },
      { id: "tag_leica", slug: "leica", name: "leica", createdAt: func("now") },
      { onConflictIgnore: true },
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "vendable_tags" },
      ["vendableId", "tagId"],
      select({
        columns: [
          column("v.id"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "tags" },
              where: [equals("slug", value("leica"))],
            }),
          ),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "vendable_tags", alias: "x" },
              where: [
                equals(
                  "x.vendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "media_assets" },
      ["id", "vendableId", "type", "url", "metadata", "createdAt"],
      select({
        columns: [
          value("media_fe880c3f-0c41-4903-9687-19b59ceed9b7"),
          column("v.id"),
          value("image"),
          value("https://fdn2.gsmarena.com/vv/bigpic/xiaomi-18-pro-max.jpg"),
          cast(value('{"role":"primary","positionIndex":0}'), "jsonb"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "media_assets", alias: "x" },
              where: [
                equals(
                  "x.id",
                  value("media_fe880c3f-0c41-4903-9687-19b59ceed9b7"),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "variants" },
      ["id", "vendableId", "sku", "name", "createdAt", "updatedAt"],
      select({
        columns: [
          value("var_1bbc44b1-0d46-4caf-9333-75c71e2a31da"),
          column("v.id"),
          value("XIAOMI-18PM-256-12"),
          value("256 Go / 12 Go RAM"),
          func("now"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "variants", alias: "x" },
              where: [
                equals(
                  "x.id",
                  value("var_1bbc44b1-0d46-4caf-9333-75c71e2a31da"),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "variant_features" },
      ["variantId", "featureId", "valueText"],
      select({
        columns: [
          value("var_1bbc44b1-0d46-4caf-9333-75c71e2a31da"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("ram_gb"))],
            }),
          ),
          value("12"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "variant_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.variantId",
                  value("var_1bbc44b1-0d46-4caf-9333-75c71e2a31da"),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("ram_gb"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "variant_features" },
      ["variantId", "featureId", "valueText"],
      select({
        columns: [
          value("var_1bbc44b1-0d46-4caf-9333-75c71e2a31da"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("storage_gb"))],
            }),
          ),
          value("256"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "variant_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.variantId",
                  value("var_1bbc44b1-0d46-4caf-9333-75c71e2a31da"),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("storage_gb"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "variant_features" },
      ["variantId", "featureId", "valueText"],
      select({
        columns: [
          value("var_1bbc44b1-0d46-4caf-9333-75c71e2a31da"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("storage_type"))],
            }),
          ),
          value("UFS 4.1"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "variant_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.variantId",
                  value("var_1bbc44b1-0d46-4caf-9333-75c71e2a31da"),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("storage_type"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "variants" },
      ["id", "vendableId", "sku", "name", "createdAt", "updatedAt"],
      select({
        columns: [
          value("var_ead3fac0-fa0c-4fc8-bd04-796de02b0e01"),
          column("v.id"),
          value("XIAOMI-18PM-512-12"),
          value("512 Go / 12 Go RAM"),
          func("now"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "variants", alias: "x" },
              where: [
                equals(
                  "x.id",
                  value("var_ead3fac0-fa0c-4fc8-bd04-796de02b0e01"),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "variant_features" },
      ["variantId", "featureId", "valueText"],
      select({
        columns: [
          value("var_ead3fac0-fa0c-4fc8-bd04-796de02b0e01"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("ram_gb"))],
            }),
          ),
          value("12"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "variant_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.variantId",
                  value("var_ead3fac0-fa0c-4fc8-bd04-796de02b0e01"),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("ram_gb"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "variant_features" },
      ["variantId", "featureId", "valueText"],
      select({
        columns: [
          value("var_ead3fac0-fa0c-4fc8-bd04-796de02b0e01"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("storage_gb"))],
            }),
          ),
          value("512"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "variant_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.variantId",
                  value("var_ead3fac0-fa0c-4fc8-bd04-796de02b0e01"),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("storage_gb"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "variant_features" },
      ["variantId", "featureId", "valueText"],
      select({
        columns: [
          value("var_ead3fac0-fa0c-4fc8-bd04-796de02b0e01"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("storage_type"))],
            }),
          ),
          value("UFS 4.1"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "variant_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.variantId",
                  value("var_ead3fac0-fa0c-4fc8-bd04-796de02b0e01"),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("storage_type"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "variants" },
      ["id", "vendableId", "sku", "name", "createdAt", "updatedAt"],
      select({
        columns: [
          value("var_afc78c4b-782f-48a1-8152-081d170bcdf0"),
          column("v.id"),
          value("XIAOMI-18PM-512-16"),
          value("512 Go / 16 Go RAM"),
          func("now"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "variants", alias: "x" },
              where: [
                equals(
                  "x.id",
                  value("var_afc78c4b-782f-48a1-8152-081d170bcdf0"),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "variant_features" },
      ["variantId", "featureId", "valueText"],
      select({
        columns: [
          value("var_afc78c4b-782f-48a1-8152-081d170bcdf0"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("ram_gb"))],
            }),
          ),
          value("16"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "variant_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.variantId",
                  value("var_afc78c4b-782f-48a1-8152-081d170bcdf0"),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("ram_gb"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "variant_features" },
      ["variantId", "featureId", "valueText"],
      select({
        columns: [
          value("var_afc78c4b-782f-48a1-8152-081d170bcdf0"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("storage_gb"))],
            }),
          ),
          value("512"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "variant_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.variantId",
                  value("var_afc78c4b-782f-48a1-8152-081d170bcdf0"),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("storage_gb"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "variant_features" },
      ["variantId", "featureId", "valueText"],
      select({
        columns: [
          value("var_afc78c4b-782f-48a1-8152-081d170bcdf0"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("storage_type"))],
            }),
          ),
          value("UFS 4.1"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "variant_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.variantId",
                  value("var_afc78c4b-782f-48a1-8152-081d170bcdf0"),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("storage_type"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "variants" },
      ["id", "vendableId", "sku", "name", "createdAt", "updatedAt"],
      select({
        columns: [
          value("var_43b5f7b9-a6e4-44f5-b6ba-c6a5f72c2f24"),
          column("v.id"),
          value("XIAOMI-18PM-1T-16"),
          value("1 To / 16 Go RAM"),
          func("now"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: { schema: "portfolio", name: "variants", alias: "x" },
              where: [
                equals(
                  "x.id",
                  value("var_43b5f7b9-a6e4-44f5-b6ba-c6a5f72c2f24"),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "variant_features" },
      ["variantId", "featureId", "valueText"],
      select({
        columns: [
          value("var_43b5f7b9-a6e4-44f5-b6ba-c6a5f72c2f24"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("ram_gb"))],
            }),
          ),
          value("16"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "variant_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.variantId",
                  value("var_43b5f7b9-a6e4-44f5-b6ba-c6a5f72c2f24"),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("ram_gb"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "variant_features" },
      ["variantId", "featureId", "valueText"],
      select({
        columns: [
          value("var_43b5f7b9-a6e4-44f5-b6ba-c6a5f72c2f24"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("storage_gb"))],
            }),
          ),
          value("1024"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "variant_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.variantId",
                  value("var_43b5f7b9-a6e4-44f5-b6ba-c6a5f72c2f24"),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("storage_gb"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "variant_features" },
      ["variantId", "featureId", "valueText"],
      select({
        columns: [
          value("var_43b5f7b9-a6e4-44f5-b6ba-c6a5f72c2f24"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("storage_type"))],
            }),
          ),
          value("UFS 4.1"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "variant_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.variantId",
                  value("var_43b5f7b9-a6e4-44f5-b6ba-c6a5f72c2f24"),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("storage_type"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "variation_groups" },
      ["id", "parentVendableId", "code", "createdAt"],
      select({
        columns: [
          value("vg_xiaomi18pm_storage_ram"),
          column("v.id"),
          value("storage_ram"),
          func("now"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "variation_groups",
                alias: "x",
              },
              where: [
                equals(
                  "x.parentVendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals("x.code", value("storage_ram")),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "variation_group_features" },
      ["id", "groupId", "featureId", "purpose"],
      select({
        columns: [
          value("vgf_xiaomi18pm_storage_ram_storage_gb"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "variation_groups" },
              where: [
                equals(
                  "parentVendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals("code", value("storage_ram")),
              ],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("storage_gb"))],
            }),
          ),
          value("variation"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "variation_group_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.groupId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "variation_groups" },
                      where: [
                        equals(
                          "parentVendableId",
                          subquery(
                            select({
                              columns: [column("v.id")],
                              from: {
                                schema: "portfolio",
                                name: "vendables",
                                alias: "v",
                              },
                              where: [
                                equals(
                                  "v.reference",
                                  value("XIAOMI-18-PRO-MAX-5G"),
                                ),
                              ],
                            }),
                          ),
                        ),
                        equals("code", value("storage_ram")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("storage_gb"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.insertSelect(
      { schema: "portfolio", name: "variation_group_features" },
      ["id", "groupId", "featureId", "purpose"],
      select({
        columns: [
          value("vgf_xiaomi18pm_storage_ram_ram_gb"),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "variation_groups" },
              where: [
                equals(
                  "parentVendableId",
                  subquery(
                    select({
                      columns: [column("v.id")],
                      from: {
                        schema: "portfolio",
                        name: "vendables",
                        alias: "v",
                      },
                      where: [
                        equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
                      ],
                    }),
                  ),
                ),
                equals("code", value("storage_ram")),
              ],
            }),
          ),
          subquery(
            select({
              columns: [column("id")],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("ram_gb"))],
            }),
          ),
          value("variation"),
        ],
        from: { schema: "portfolio", name: "vendables", alias: "v" },
        where: [
          equals("v.reference", value("XIAOMI-18-PRO-MAX-5G")),
          notExists(
            select({
              columns: [constant(1)],
              from: {
                schema: "portfolio",
                name: "variation_group_features",
                alias: "x",
              },
              where: [
                equals(
                  "x.groupId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "variation_groups" },
                      where: [
                        equals(
                          "parentVendableId",
                          subquery(
                            select({
                              columns: [column("v.id")],
                              from: {
                                schema: "portfolio",
                                name: "vendables",
                                alias: "v",
                              },
                              where: [
                                equals(
                                  "v.reference",
                                  value("XIAOMI-18-PRO-MAX-5G"),
                                ),
                              ],
                            }),
                          ),
                        ),
                        equals("code", value("storage_ram")),
                      ],
                    }),
                  ),
                ),
                equals(
                  "x.featureId",
                  subquery(
                    select({
                      columns: [column("id")],
                      from: { schema: "portfolio", name: "features" },
                      where: [equals("code", value("ram_gb"))],
                    }),
                  ),
                ),
              ],
            }),
          ),
        ],
      }),
    );
    context.data.update(
      { schema: "portfolio", name: "vendables" },
      { slug: value("xiaomi-18-pro-max-5g") },
      [equals("reference", value("XIAOMI-18-PRO-MAX-5G")), isNull("slug")],
    );
    context.schema.dropColumn(
      { schema: "portfolio", name: "vendables" },
      "content",
      { ifExists: true },
    );
    context.schema.dropColumn(
      { schema: "portfolio", name: "vendables" },
      "characteristics",
      { ifExists: true },
    );
    context.schema.dropColumn(
      { schema: "portfolio", name: "vendables" },
      "classification",
      { ifExists: true },
    );
    context.schema.dropColumn(
      { schema: "portfolio", name: "vendables" },
      "media",
      { ifExists: true },
    );
    context.schema.dropColumn(
      { schema: "portfolio", name: "vendables" },
      "variants",
      { ifExists: true },
    );
    context.schema.dropColumn(
      { schema: "portfolio", name: "vendables" },
      "relations",
      { ifExists: true },
    );
    context.schema.dropColumn(
      { schema: "portfolio", name: "vendables" },
      "quality",
      { ifExists: true },
    );
  },
  downMigration: (context: MigrationContext) => {
    context.schema.addColumn(
      { schema: "portfolio", name: "vendables" },
      "content",
      "json",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true },
    );
    context.schema.addColumn(
      { schema: "portfolio", name: "vendables" },
      "characteristics",
      "json",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true },
    );
    context.schema.addColumn(
      { schema: "portfolio", name: "vendables" },
      "classification",
      "json",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true },
    );
    context.schema.addColumn(
      { schema: "portfolio", name: "vendables" },
      "media",
      "json",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true },
    );
    context.schema.addColumn(
      { schema: "portfolio", name: "vendables" },
      "variants",
      "json",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true },
    );
    context.schema.addColumn(
      { schema: "portfolio", name: "vendables" },
      "relations",
      "json",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true },
    );
    context.schema.addColumn(
      { schema: "portfolio", name: "vendables" },
      "quality",
      "json",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true },
    );
    context.schema.dropColumn(
      { schema: "portfolio", name: "vendables" },
      "slug",
      { ifExists: true },
    );
    context.schema.dropColumn(
      { schema: "portfolio", name: "vendables" },
      "metaTitle",
      { ifExists: true },
    );
    context.schema.dropColumn(
      { schema: "portfolio", name: "vendables" },
      "metaDesc",
      { ifExists: true },
    );
    context.schema.dropTable(
      { schema: "portfolio", name: "translation_keywords" },
      { ifExists: true, schema: "portfolio" },
    );
    context.schema.dropTable(
      { schema: "portfolio", name: "vendable_tags" },
      { ifExists: true, schema: "portfolio" },
    );
    context.schema.dropTable(
      { schema: "portfolio", name: "tags" },
      { ifExists: true, schema: "portfolio" },
    );
  },
};
