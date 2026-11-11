import {
  column,
  constant,
  equals,
  inSubquery,
  inValues,
  notExists,
  select,
  subquery,
  value,
  type Migration,
  type MigrationContext,
} from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM = "7c13659bcedd9487ea7cdf7be77980aa4d5fdc8095b0db3a438151c0a870681a";
/* checksum:end */

/**
 * portfolio.catalog.v1.006 — correctifs de la bascule normalisee (ADR-0018).
 *
 * Contexte : v1.005 s'est appliquee sur un etat partiel (premiere tentative
 * pre-correctifs + sondes diagnostiques, epoque ou les transactions PG
 * n'etaient pas atomiques — voir correctif `checkout()` dedie dans
 * `@mosaix/adapter-database-postgres`). Les gardes d'idempotence ont fige
 * trois ecarts, corriges ici de facon convergente et rejouable :
 *
 * 1. `purpose = 'multivalue'` sur les 6 features enumerees multi/singletons
 *    (regle uniforme ADR-0018 : tout tableau -> joint ", " + split lecture).
 * 2. Attributs de variante en texte (`storage_gb`, `ram_gb` : 'N' -> 'T'),
 *    conformement au contrat d'entree propose/CSV (chaines).
 * 3. `misc.models` : lien variantId isole -> valeur jointe (regle uniforme).
 * 4. Les 7 mappings de tags manquants (garde incomplete dans le backfill
 *    v1.005 : `NOT EXISTS` sans le tagId).
 *
 * Postgres-only. Idempotent (rejouable sans effet).
 *
 * The data statements are declared with the `context.data` API (structured
 * inserts, updates and deletes): the engine compiles them with the grammar of
 * the target dialect and binds the values as statement parameters. No SQL
 * string is carried by the migration.
 *
 * Historical note: this migration was previously declared as a raw SQL
 * string (SQL legacy mode, removed from the engine). Its historical
 * checksum is kept in `legacyChecksums` so that databases where it is
 * already applied are not rejected by the Planner.
 */

/** The features whose purpose is normalized to `multivalue`. */
const MULTIVALUE_CODES = [
  "options.storage_ram.values",
  "options.color.values",
  "options.weight.values",
  "misc.colors",
  "memory.options",
  "misc.models",
];

/** The features whose variant attributes are normalized to the `T` type. */
const TYPE_T_CODES = ["storage_gb", "ram_gb"];

/** The tags backfilled on the `XIAOMI-18-PRO-MAX-5G` vendable. */
const BACKFILLED_TAGS = [
  "smartphone",
  "5g",
  "amoled",
  "snapdragon-8-elite",
  "ip68",
  "flagship",
  "leica",
];

/** The vendable reference the tags are attached to. */
const VENDABLE_REFERENCE = "XIAOMI-18-PRO-MAX-5G";

export const migration: Migration = {
  id: "portfolio.catalog.v1.006_normalize_fixes",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["b1aec560b11d23c4"],
  up: (context: MigrationContext) => {
    context.data.update(
      { schema: "portfolio", name: "features" },
      { purpose: value("multivalue") },
      [inValues("code", MULTIVALUE_CODES)],
    );
    context.data.update(
      { schema: "portfolio", name: "features" },
      { featureType: value("T") },
      [inValues("code", TYPE_T_CODES)],
    );
    context.data.update(
      { schema: "portfolio", name: "vendable_features" },
      { variantId: null, valueText: value("2611FPNFAG") },
      [
        equals(
          "featureId",
          subquery(
            select({
              columns: ["id"],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("misc.models"))],
            }),
          ),
        ),
      ],
    );

    for (const slug of BACKFILLED_TAGS) {
      context.data.insertSelect(
        { schema: "portfolio", name: "vendable_tags" },
        ["vendableId", "tagId"],
        select({
          columns: [
            column("v.id"),
            subquery(
              select({
                columns: ["id"],
                from: { schema: "portfolio", name: "tags" },
                where: [equals("slug", value(slug))],
              }),
            ),
          ],
          from: { schema: "portfolio", name: "vendables", alias: "v" },
          where: [
            equals("v.reference", value(VENDABLE_REFERENCE)),
            notExists(
              select({
                columns: [constant(1)],
                from: {
                  schema: "portfolio",
                  name: "vendable_tags",
                  alias: "x",
                },
                where: [
                  equals("x.vendableId", column("v.id")),
                  equals(
                    "x.tagId",
                    subquery(
                      select({
                        columns: ["id"],
                        from: { schema: "portfolio", name: "tags" },
                        where: [equals("slug", value(slug))],
                      }),
                    ),
                  ),
                ],
              }),
            ),
          ],
        }),
      );
    }
  },
  downMigration: (context: MigrationContext) => {
    context.data.update(
      { schema: "portfolio", name: "features" },
      { purpose: value("additional") },
      [inValues("code", MULTIVALUE_CODES)],
    );
    context.data.update(
      { schema: "portfolio", name: "features" },
      { featureType: value("N") },
      [inValues("code", TYPE_T_CODES)],
    );
    context.data.update(
      { schema: "portfolio", name: "vendable_features" },
      {
        variantId: subquery(
          select({
            columns: ["id"],
            from: { schema: "portfolio", name: "feature_variants" },
            where: [
              equals(
                "featureId",
                subquery(
                  select({
                    columns: ["id"],
                    from: { schema: "portfolio", name: "features" },
                    where: [equals("code", value("misc.models"))],
                  }),
                ),
              ),
              equals("variant", value("2611FPNFAG")),
            ],
          }),
        ),
        valueText: null,
      },
      [
        equals(
          "featureId",
          subquery(
            select({
              columns: ["id"],
              from: { schema: "portfolio", name: "features" },
              where: [equals("code", value("misc.models"))],
            }),
          ),
        ),
      ],
    );
    context.data.delete({ schema: "portfolio", name: "vendable_tags" }, [
      inSubquery(
        "tagId",
        select({
          columns: ["id"],
          from: { schema: "portfolio", name: "tags" },
          where: [inValues("slug", BACKFILLED_TAGS)],
        }),
      ),
    ]);
  },
  resources: [
    // v1.006_normalize_pim_fixes MODIFIE des tables existantes (UPDATE features,
    // UPDATE vendable_features, INSERT vendable_tags). R9 exige au moins une
    // ressource déclarée pour la détection de collisions.
    "table:portfolio.features",
    "table:portfolio.vendable_features",
    "table:portfolio.vendable_tags",
    "table:portfolio.vendables",
  ],
};
