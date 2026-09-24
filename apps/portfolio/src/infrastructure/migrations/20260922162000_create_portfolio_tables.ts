import { SchemaBuilder, PostgresGrammar, computeChecksum, type Migration } from "@mosaix/migrations";

const builder = new SchemaBuilder();
const grammar = new PostgresGrammar();

// 1. Portfolio Vendables (PIM Catalog Core)
builder.createTable("portfolio_vendables", (table) => {
  table.string("id").primary();
  table.string("reference");
  table.enum("type", ["Product", "Service", "DigitalProduct", "Experience"]);
  table.enum("status", ["Draft", "In Review", "Published", "Archived"]);
  table.json("content").nullable();
  table.json("classification").nullable();
  table.json("quality").nullable();
  table.timestamp("createdAt");
  table.timestamp("updatedAt");
  table.unique("uniq_vendable_reference", ["reference"]);
  table.index("idx_vendable_type_status", ["type", "status"]);
});

// 2. Portfolio Categories
builder.createTable("portfolio_categories", (table) => {
  table.string("id").primary();
  table.string("slug");
  table.string("name");
  table.string("parentId").nullable();
  table.timestamp("createdAt");
  table.foreignKey("parentId", "portfolio_categories", "id");
  table.unique("uniq_portfolio_cat_slug", ["slug"]);
  table.index("idx_portfolio_cat_parent", ["parentId"]);
});

// 3. Portfolio Vendable Categories Mapping
builder.createTable("portfolio_vendable_categories", (table) => {
  table.string("vendableId");
  table.string("categoryId");
  table.foreignKey("vendableId", "portfolio_vendables", "id");
  table.foreignKey("categoryId", "portfolio_categories", "id");
  table.unique("uniq_vendable_category", ["vendableId", "categoryId"]);
  table.index("idx_vendable_cats_category", ["categoryId"]);
});

// 4. Portfolio Variants (Abstract Catalog Variant without stock/price)
builder.createTable("portfolio_variants", (table) => {
  table.string("id").primary();
  table.string("vendableId");
  table.string("sku");
  table.string("name");
  table.timestamp("createdAt");
  table.timestamp("updatedAt");
  table.foreignKey("vendableId", "portfolio_vendables", "id");
  table.unique("uniq_portfolio_variant_sku", ["sku"]);
  table.index("idx_portfolio_variant_vendable", ["vendableId"]);
});

// 5. Portfolio Translations
builder.createTable("portfolio_translations", (table) => {
  table.string("id").primary();
  table.string("vendableId");
  table.string("lang");
  table.string("name");
  table.string("shortDescription").nullable();
  table.string("description").nullable();
  table.timestamp("createdAt");
  table.foreignKey("vendableId", "portfolio_vendables", "id");
  table.unique("uniq_vendable_translation_lang", ["vendableId", "lang"]);
  table.index("idx_portfolio_trans_vendable_lang", ["vendableId", "lang"]);
});

// 6. Portfolio Relations
builder.createTable("portfolio_relations", (table) => {
  table.string("id").primary();
  table.string("sourceVendableId");
  table.string("targetVendableId");
  table.string("relationType");
  table.timestamp("createdAt");
  table.foreignKey("sourceVendableId", "portfolio_vendables", "id");
  table.foreignKey("targetVendableId", "portfolio_vendables", "id");
  table.index("idx_portfolio_rel_source", ["sourceVendableId"]);
});

// 7. Portfolio Media Assets
builder.createTable("portfolio_media_assets", (table) => {
  table.string("id").primary();
  table.string("vendableId");
  table.string("type");
  table.string("url");
  table.json("metadata").nullable();
  table.timestamp("createdAt");
  table.foreignKey("vendableId", "portfolio_vendables", "id");
  table.index("idx_portfolio_media_vendable", ["vendableId"]);
});

// 8. CS-Cart Product Feature Groups
builder.createTable("portfolio_feature_groups", (table) => {
  table.string("id").primary();
  table.string("code");
  table.string("name");
  table.timestamp("createdAt");
  table.unique("uniq_feature_group_code", ["code"]);
});

// 9. CS-Cart Product Features
builder.createTable("portfolio_features", (table) => {
  table.string("id").primary();
  table.string("groupId").nullable();
  table.string("code");
  table.enum("featureType", ["S", "E", "T", "N", "D", "C"]); // Single, Enum, Text, Number, Date, Checkbox
  table.string("purpose").default("additional"); // filter, variation_separate, variation_one, brand, additional
  table.string("description").nullable();
  table.boolean("isFilterable").default(true);
  table.timestamp("createdAt");
  table.foreignKey("groupId", "portfolio_feature_groups", "id");
  table.unique("uniq_feature_code", ["code"]);
  table.index("idx_features_group", ["groupId"]);
});

// 10. CS-Cart Product Feature Variants
builder.createTable("portfolio_feature_variants", (table) => {
  table.string("id").primary();
  table.string("featureId");
  table.string("variant");
  table.timestamp("createdAt");
  table.foreignKey("featureId", "portfolio_features", "id");
  table.unique("uniq_feature_variant_value", ["featureId", "variant"]);
  table.index("idx_feature_variants_feature", ["featureId"]);
});

// 11. CS-Cart Product Vendable Features Mapping
builder.createTable("portfolio_vendable_features", (table) => {
  table.string("id").primary();
  table.string("vendableId");
  table.string("featureId");
  table.string("valueText").nullable();
  table.string("variantId").nullable();
  table.timestamp("createdAt");
  table.foreignKey("vendableId", "portfolio_vendables", "id");
  table.foreignKey("featureId", "portfolio_features", "id");
  table.foreignKey("variantId", "portfolio_feature_variants", "id");
  table.unique("uniq_vendable_feature", ["vendableId", "featureId"]);
  table.index("idx_vendable_features_vendable", ["vendableId"]);
});

// 12. CS-Cart Product Variant Features (Attributes defining what a Variant is)
builder.createTable("portfolio_variant_features", (table) => {
  table.string("variantId");
  table.string("featureId");
  table.string("variantValueId").nullable();
  table.string("valueText").nullable();
  table.foreignKey("variantId", "portfolio_variants", "id");
  table.foreignKey("featureId", "portfolio_features", "id");
  table.foreignKey("variantValueId", "portfolio_feature_variants", "id");
  table.unique("uniq_variant_feature", ["variantId", "featureId"]);
});

// 13. CS-Cart Variation Groups
builder.createTable("portfolio_variation_groups", (table) => {
  table.string("id").primary();
  table.string("parentVendableId");
  table.string("code");
  table.timestamp("createdAt");
  table.foreignKey("parentVendableId", "portfolio_vendables", "id");
  table.index("idx_variation_groups_parent", ["parentVendableId"]);
});

// 14. CS-Cart Variation Group Features
builder.createTable("portfolio_variation_group_features", (table) => {
  table.string("id").primary();
  table.string("groupId");
  table.string("featureId");
  table.string("purpose");
  table.foreignKey("groupId", "portfolio_variation_groups", "id");
  table.foreignKey("featureId", "portfolio_features", "id");
});

const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));

export const migration: Migration = {
  id: "20260922162000_create_portfolio_tables",
  content: statements.map((s) => s.sql).join("\n"),
  checksum: computeChecksum(statements.map((s) => s.sql).join("\n")),
  resources: [
    "table:portfolio_vendables",
    "table:portfolio_categories",
    "table:portfolio_vendable_categories",
    "table:portfolio_variants",
    "table:portfolio_translations",
    "table:portfolio_relations",
    "table:portfolio_media_assets",
    "table:portfolio_feature_groups",
    "table:portfolio_features",
    "table:portfolio_feature_variants",
    "table:portfolio_vendable_features",
    "table:portfolio_variant_features",
    "table:portfolio_variation_groups",
    "table:portfolio_variation_group_features",
  ]
};
