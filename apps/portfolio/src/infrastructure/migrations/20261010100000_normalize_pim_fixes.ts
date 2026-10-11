import { computeChecksum, type Migration } from "@mosaix/migrations";

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
 */

const upStatements: string[] = [
  `UPDATE "portfolio"."features" SET "purpose" = $$multivalue$$ WHERE "code" IN ($$options.storage_ram.values$$, $$options.color.values$$, $$options.weight.values$$, $$misc.colors$$, $$memory.options$$, $$misc.models$$);`,
  `UPDATE "portfolio"."features" SET "featureType" = $$T$$ WHERE "code" IN ($$storage_gb$$, $$ram_gb$$);`,
  `UPDATE "portfolio"."vendable_features" SET "variantId" = NULL, "valueText" = $$2611FPNFAG$$ WHERE "featureId" = (SELECT "id" FROM "portfolio"."features" WHERE "code" = $$misc.models$$);`,
  `INSERT INTO "portfolio"."vendable_tags" ("vendableId", "tagId") SELECT v."id", (SELECT "id" FROM "portfolio"."tags" WHERE "slug" = $$smartphone$$) FROM "portfolio"."vendables" AS v WHERE v."reference" = $$XIAOMI-18-PRO-MAX-5G$$ AND NOT EXISTS (SELECT 1 FROM "portfolio"."vendable_tags" AS x WHERE x."vendableId" = v."id" AND x."tagId" = (SELECT "id" FROM "portfolio"."tags" WHERE "slug" = $$smartphone$$));`,
  `INSERT INTO "portfolio"."vendable_tags" ("vendableId", "tagId") SELECT v."id", (SELECT "id" FROM "portfolio"."tags" WHERE "slug" = $$5g$$) FROM "portfolio"."vendables" AS v WHERE v."reference" = $$XIAOMI-18-PRO-MAX-5G$$ AND NOT EXISTS (SELECT 1 FROM "portfolio"."vendable_tags" AS x WHERE x."vendableId" = v."id" AND x."tagId" = (SELECT "id" FROM "portfolio"."tags" WHERE "slug" = $$5g$$));`,
  `INSERT INTO "portfolio"."vendable_tags" ("vendableId", "tagId") SELECT v."id", (SELECT "id" FROM "portfolio"."tags" WHERE "slug" = $$amoled$$) FROM "portfolio"."vendables" AS v WHERE v."reference" = $$XIAOMI-18-PRO-MAX-5G$$ AND NOT EXISTS (SELECT 1 FROM "portfolio"."vendable_tags" AS x WHERE x."vendableId" = v."id" AND x."tagId" = (SELECT "id" FROM "portfolio"."tags" WHERE "slug" = $$amoled$$));`,
  `INSERT INTO "portfolio"."vendable_tags" ("vendableId", "tagId") SELECT v."id", (SELECT "id" FROM "portfolio"."tags" WHERE "slug" = $$snapdragon-8-elite$$) FROM "portfolio"."vendables" AS v WHERE v."reference" = $$XIAOMI-18-PRO-MAX-5G$$ AND NOT EXISTS (SELECT 1 FROM "portfolio"."vendable_tags" AS x WHERE x."vendableId" = v."id" AND x."tagId" = (SELECT "id" FROM "portfolio"."tags" WHERE "slug" = $$snapdragon-8-elite$$));`,
  `INSERT INTO "portfolio"."vendable_tags" ("vendableId", "tagId") SELECT v."id", (SELECT "id" FROM "portfolio"."tags" WHERE "slug" = $$ip68$$) FROM "portfolio"."vendables" AS v WHERE v."reference" = $$XIAOMI-18-PRO-MAX-5G$$ AND NOT EXISTS (SELECT 1 FROM "portfolio"."vendable_tags" AS x WHERE x."vendableId" = v."id" AND x."tagId" = (SELECT "id" FROM "portfolio"."tags" WHERE "slug" = $$ip68$$));`,
  `INSERT INTO "portfolio"."vendable_tags" ("vendableId", "tagId") SELECT v."id", (SELECT "id" FROM "portfolio"."tags" WHERE "slug" = $$flagship$$) FROM "portfolio"."vendables" AS v WHERE v."reference" = $$XIAOMI-18-PRO-MAX-5G$$ AND NOT EXISTS (SELECT 1 FROM "portfolio"."vendable_tags" AS x WHERE x."vendableId" = v."id" AND x."tagId" = (SELECT "id" FROM "portfolio"."tags" WHERE "slug" = $$flagship$$));`,
  `INSERT INTO "portfolio"."vendable_tags" ("vendableId", "tagId") SELECT v."id", (SELECT "id" FROM "portfolio"."tags" WHERE "slug" = $$leica$$) FROM "portfolio"."vendables" AS v WHERE v."reference" = $$XIAOMI-18-PRO-MAX-5G$$ AND NOT EXISTS (SELECT 1 FROM "portfolio"."vendable_tags" AS x WHERE x."vendableId" = v."id" AND x."tagId" = (SELECT "id" FROM "portfolio"."tags" WHERE "slug" = $$leica$$));`,
];

const downStatements: string[] = [
  `UPDATE "portfolio"."features" SET "purpose" = $$additional$$ WHERE "code" IN ($$options.storage_ram.values$$, $$options.color.values$$, $$options.weight.values$$, $$misc.colors$$, $$memory.options$$, $$misc.models$$);`,
  `UPDATE "portfolio"."features" SET "featureType" = $$N$$ WHERE "code" IN ($$storage_gb$$, $$ram_gb$$);`,
  `UPDATE "portfolio"."vendable_features" SET "variantId" = (SELECT "id" FROM "portfolio"."feature_variants" WHERE "featureId" = (SELECT "id" FROM "portfolio"."features" WHERE "code" = $$misc.models$$) AND "variant" = $$2611FPNFAG$$), "valueText" = NULL WHERE "featureId" = (SELECT "id" FROM "portfolio"."features" WHERE "code" = $$misc.models$$);`,
  `DELETE FROM "portfolio"."vendable_tags" WHERE "tagId" IN (SELECT "id" FROM "portfolio"."tags" WHERE "slug" IN ($$smartphone$$, $$5g$$, $$amoled$$, $$snapdragon-8-elite$$, $$ip68$$, $$flagship$$, $$leica$$));`,
];

const sqlContent = upStatements.join("\n");
const sqlDown = downStatements.join("\n");

export const migration: Migration = {
  id: "20261010100000_normalize_pim_fixes",
  content: sqlContent,
  down: sqlDown,
  checksum: computeChecksum(sqlContent),
  resources: [
    "table:portfolio.features",
    "table:portfolio.vendable_features",
    "table:portfolio.vendable_tags",
  ],
};
