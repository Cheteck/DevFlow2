/**
 * @apps/portfolio — PostgreSQL adapter for VendableRepository (ADR-0018).
 *
 * The normalized `portfolio.*` tables are the source of truth; the document
 * `Vendable` stays the domain contract, and this repository is the
 * anti-corruption layer projecting document <-> tables on every access:
 *
 * - `vendables` scalars + `slug/metaTitle/metaDesc`, `translations` (+keywords),
 *   `categories`/`tags` (+mappings), `media_assets`, `variants` (+`variant_features`),
 *   `relations`, `features`/`feature_groups`/`feature_variants` (+assignments),
 *   `variation_groups` (+links, rebuilt from SKU-bearing option axes).
 * - `save` replaces children wholesale inside one transaction (upsert head,
 *   delete-then-insert children); catalog rows are get-or-created by stable code.
 * - Reads reassemble the document; order is deterministic, not positional:
 *   media by `metadata.positionIndex`, variants by `sku`, tags/categories/
 *   keywords alphabetically. `quality` is never stored (computed by the service
 *   on read); `collections`, variant i18n beyond the stored name, variant media
 *   and relation metadata have no normalized home and are omitted (ADR-0018).
 */

import { randomUUID } from "node:crypto";
import type {
  DatabaseConnection,
  DatabasePort,
} from "@mosaix/ports-database";
import type { VendableRepository } from "../domain/vendable-repository.js";
import { normalizeFeatureCode } from "../domain/product-options.js";
import type {
  Vendable,
  VendableContent,
  VendableMedia,
  VendableRelations,
  VendableType,
  VendableVariants,
  WorkflowStatus,
} from "../domain/vendable.js";

const VENDABLES_TABLE = `"portfolio"."vendables"`;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function inferFeatureType(value: unknown): "N" | "C" | "T" {
  if (typeof value === "number") return "N";
  if (typeof value === "boolean") return "C";
  return "T";
}

function coerceValue(valueText: string, featureType: string): unknown {
  if (featureType === "N") {
    const num = Number(valueText);
    return Number.isNaN(num) ? valueText : num;
  }
  if (featureType === "C") return valueText === "true";
  return valueText;
}

function setNested(
  target: Record<string, unknown>,
  path: string[],
  value: unknown,
): void {
  let node = target;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i] as string;
    const existing = node[key];
    if (typeof existing !== "object" || existing === null) {
      node[key] = {};
    }
    node = node[key] as Record<string, unknown>;
  }
  node[path[path.length - 1] as string] = value;
}

interface AssignmentRow {
  code: string;
  featureType: string;
  groupCode: string;
  purpose: string;
  valueText: string | null;
  enumValue: string | null;
}

function resolveAssignmentValue(row: {
  featureType: string;
  purpose: string;
  valueText: string | null;
  enumValue: string | null;
}): { present: boolean; value?: unknown } {
  if (row.enumValue !== null && row.enumValue !== undefined) {
    return { present: true, value: row.enumValue };
  }
  if (row.valueText === null || row.valueText === undefined) {
    return { present: false };
  }
  // Multi-valeurs jointes a l'ecriture (UNIQUE vendableId+featureId) : split.
  if (row.purpose === "multivalue") {
    return { present: true, value: asString(row.valueText).split(", ") };
  }
  return { present: true, value: coerceValue(asString(row.valueText), row.featureType) };
}

/**
 * Canonicalise un document avant ecriture : les cles (codes de features,
 * slugs, langues) sont normalisees et le premier ecrit gagne. Sans cela,
 * des variantes d'ecriture ("Chipset"/"chipset ") violeraient les
 * contraintes d'unicite (UNIQUE vendable+feature, mappings) au lieu de
 * fusionner. Idempotent et sans effet sur les documents deja canoniques.
 */
function canonicalizeAttributes(
  attributes: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const seen = new Set<string>();
  for (const [rawKey, value] of Object.entries(attributes)) {
    const key = normalizeFeatureCode(rawKey);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out[key] = value;
  }
  return out;
}

function canonicalizeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const key = slugify(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}

function canonicalizeVendable(vendable: Vendable): Vendable {
  const content: VendableContent = {};
  for (const [rawLang, entry] of Object.entries(vendable.content)) {
    const lang = rawLang.trim().toLowerCase();
    if (!lang || content[lang] !== undefined) continue;
    content[lang] = entry;
  }
  const specifications: Record<string, unknown> = {};
  for (const [rawGroup, specs] of Object.entries(
    vendable.characteristics.specifications ?? {},
  )) {
    const group = normalizeFeatureCode(rawGroup);
    if (!group || specifications[group] !== undefined) continue;
    if (specs !== null && typeof specs === "object" && !Array.isArray(specs)) {
      const clean: Record<string, unknown> = {};
      for (const [rawKey, value] of Object.entries(
        specs as Record<string, unknown>,
      )) {
        const key = normalizeFeatureCode(rawKey);
        if (!key || key in clean) continue;
        clean[key] = value;
      }
      specifications[group] = clean;
    } else {
      specifications[group] = specs;
    }
  }
  return {
    ...vendable,
    content,
    characteristics: {
      attributes: canonicalizeAttributes(
        vendable.characteristics.attributes ?? {},
      ),
      specifications,
    },
    classification: {
      categories: canonicalizeStrings(
        vendable.classification.categories ?? [],
      ),
      tags: canonicalizeStrings(vendable.classification.tags ?? []),
      collections: vendable.classification.collections ?? [],
    },
    variants: vendable.variants.map((variant) => ({
      ...variant,
      characteristics: variant.characteristics
        ? {
            attributes: canonicalizeAttributes(
              variant.characteristics.attributes ?? {},
            ),
          }
        : undefined,
    })),
  };
}

export class PostgresVendableRepository implements VendableRepository {
  constructor(private readonly db: DatabasePort) {}

  async save(vendable: Vendable): Promise<void> {
    const canonical = canonicalizeVendable(vendable);
    await this.db.transaction(async (tx) => {
      await this.upsertHead(tx, canonical);
      await this.deleteChildren(tx, canonical.identity.id);
      await this.insertChildren(tx, canonical);
    });
  }

  async findById(id: string): Promise<Vendable | undefined> {
    const found = await this.loadMany([id]);
    return found[0];
  }

  async findByReference(
    reference: string,
  ): Promise<Vendable | undefined> {
    const rows = await this.db.query<{ id: string }>(
      `SELECT id FROM ${VENDABLES_TABLE} WHERE reference = $1`,
      [reference],
    );
    const id = rows[0]?.id;
    if (!id) return undefined;
    return this.findById(id);
  }

  async findAll(): Promise<Vendable[]> {
    const rows = await this.db.query<{ id: string }>(
      `SELECT id FROM ${VENDABLES_TABLE}`,
    );
    return this.loadMany(rows.map((r) => r.id));
  }

  async delete(id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.deleteChildren(tx, id);
      await tx.execute(`DELETE FROM ${VENDABLES_TABLE} WHERE id = $1`, [id]);
    });
  }

  // ---------- write path ----------

  private async upsertHead(
    tx: DatabaseConnection,
    vendable: Vendable,
  ): Promise<void> {
    const now = new Date().toISOString();
    await tx.execute(
      `INSERT INTO ${VENDABLES_TABLE} (id, reference, type, status, slug, "metaTitle", "metaDesc", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         reference = $2, type = $3, status = $4, slug = $5,
         "metaTitle" = $6, "metaDesc" = $7, "updatedAt" = $9`,
      [
        vendable.identity.id,
        vendable.identity.reference,
        vendable.identity.type,
        vendable.identity.status,
        vendable.seo?.slug ?? null,
        vendable.seo?.metaTitle ?? null,
        vendable.seo?.metaDesc ?? null,
        now,
        now,
      ],
    );
  }

  private async deleteChildren(
    tx: DatabaseConnection,
    vendableId: string,
  ): Promise<void> {
    await tx.execute(
      `DELETE FROM "portfolio"."variant_features" WHERE "variantId" IN (SELECT id FROM "portfolio"."variants" WHERE "vendableId" = $1)`,
      [vendableId],
    );
    // Groupes de variation reconstruits a chaque save : purges pour ne
    // jamais accumuler d'axes obsoletes.
    await tx.execute(
      `DELETE FROM "portfolio"."variation_group_features" WHERE "groupId" IN (SELECT id FROM "portfolio"."variation_groups" WHERE "parentVendableId" = $1)`,
      [vendableId],
    );
    await tx.execute(
      `DELETE FROM "portfolio"."variation_groups" WHERE "parentVendableId" = $1`,
      [vendableId],
    );
    await tx.execute(
      `DELETE FROM "portfolio"."variation_group_features" WHERE "groupId" IN (SELECT id FROM "portfolio"."variation_groups" WHERE "parentVendableId" = $1)`,
      [vendableId],
    );
    await tx.execute(
      `DELETE FROM "portfolio"."variation_groups" WHERE "parentVendableId" = $1`,
      [vendableId],
    );
    await tx.execute(
      `DELETE FROM "portfolio"."variants" WHERE "vendableId" = $1`,
      [vendableId],
    );
    await tx.execute(
      `DELETE FROM "portfolio"."vendable_features" WHERE "vendableId" = $1`,
      [vendableId],
    );
    await tx.execute(
      `DELETE FROM "portfolio"."translations" WHERE "vendableId" = $1`,
      [vendableId],
    );
    await tx.execute(
      `DELETE FROM "portfolio"."translation_keywords" WHERE "vendableId" = $1`,
      [vendableId],
    );
    await tx.execute(
      `DELETE FROM "portfolio"."vendable_categories" WHERE "vendableId" = $1`,
      [vendableId],
    );
    await tx.execute(
      `DELETE FROM "portfolio"."vendable_tags" WHERE "vendableId" = $1`,
      [vendableId],
    );
    await tx.execute(
      `DELETE FROM "portfolio"."media_assets" WHERE "vendableId" = $1`,
      [vendableId],
    );
    await tx.execute(
      `DELETE FROM "portfolio"."relations" WHERE "sourceVendableId" = $1 OR "targetVendableId" = $1`,
      [vendableId],
    );
  }

  private async ensureGroup(
    tx: DatabaseConnection,
    code: string,
    name: string,
  ): Promise<void> {
    await tx.execute(
      `INSERT INTO "portfolio"."feature_groups" ("id", "code", "name", "createdAt") VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [`fgrp_${slugify(code)}`, code, name, new Date().toISOString()],
    );
  }

  private async ensureFeature(
    tx: DatabaseConnection,
    code: string,
    groupCode: string,
    featureType: string,
    purpose = "additional",
  ): Promise<void> {
    // Defense en profondeur : le code est canonicalise a chaque point
    // d'ecriture, re-normalise ici pour tout appelant direct.
    const clean = normalizeFeatureCode(code);
    if (!clean) return;
    await tx.execute(
      `INSERT INTO "portfolio"."features" ("id", "groupId", "code", "featureType", "purpose", "createdAt")
       SELECT $1, g."id", $2, $3, $4, $5 FROM "portfolio"."feature_groups" AS g WHERE g."code" = $6
       ON CONFLICT DO NOTHING`,
      [
        `feat_${slugify(clean)}`,
        clean,
        featureType,
        purpose,
        new Date().toISOString(),
        groupCode,
      ],
    );
  }

  private async ensureFeatureVariant(
    tx: DatabaseConnection,
    featureCode: string,
    value: string,
  ): Promise<void> {
    const code = normalizeFeatureCode(featureCode);
    if (!code) return;
    await tx.execute(
      `INSERT INTO "portfolio"."feature_variants" ("id", "featureId", "variant", "createdAt")
       SELECT $1, f."id", $2, $3 FROM "portfolio"."features" AS f WHERE f."code" = $4
       ON CONFLICT DO NOTHING`,
      [
        `fvar_${slugify(code)}_${slugify(value)}`,
        value,
        new Date().toISOString(),
        code,
      ],
    );
  }

  private async insertChildren(
    tx: DatabaseConnection,
    vendable: Vendable,
  ): Promise<void> {
    const id = vendable.identity.id;
    const now = new Date().toISOString();

    // Translations (+ keywords). Langue canonicalisee (fr == FR).
    for (const [rawLang, content] of Object.entries(vendable.content)) {
      const lang = rawLang.trim().toLowerCase();
      if (!lang) continue;
      await tx.execute(
        `INSERT INTO "portfolio"."translations" ("id", "vendableId", "lang", "name", "shortDescription", "description", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          `tr_${slugify(id)}_${slugify(lang)}`,
          id,
          lang,
          content.name,
          content.shortDescription ?? null,
          content.description ?? null,
          now,
        ],
      );
      for (const keyword of content.keywords ?? []) {
        await tx.execute(
          `INSERT INTO "portfolio"."translation_keywords" ("vendableId", "lang", "keyword") VALUES ($1, $2, $3)`,
          [id, lang, keyword],
        );
      }
    }

    // Categories + tags (get-or-create by slug canonique ; le libelle
    // d'origine est preserve dans `name`, le slug normalise evite les
    // doublons "Smart Phones"/"smartphones").
    for (const rawCategory of vendable.classification.categories ?? []) {
      const category = slugify(rawCategory);
      if (!category) continue;
      await tx.execute(
        `INSERT INTO "portfolio"."categories" ("id", "slug", "name", "createdAt") VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [`cat_${category}`, category, rawCategory, now],
      );
      await tx.execute(
        `INSERT INTO "portfolio"."vendable_categories" ("vendableId", "categoryId")
         SELECT $1, c."id" FROM "portfolio"."categories" AS c WHERE c."slug" = $2`,
        [id, category],
      );
    }
    for (const rawTag of vendable.classification.tags ?? []) {
      const tag = slugify(rawTag);
      if (!tag) continue;
      await tx.execute(
        `INSERT INTO "portfolio"."tags" ("id", "slug", "name", "createdAt") VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [`tag_${tag}`, tag, rawTag, now],
      );
      await tx.execute(
        `INSERT INTO "portfolio"."vendable_tags" ("vendableId", "tagId")
         SELECT $1, t."id" FROM "portfolio"."tags" AS t WHERE t."slug" = $2`,
        [id, tag],
      );
    }

    // Media.
    for (const item of vendable.media) {
      await tx.execute(
        `INSERT INTO "portfolio"."media_assets" ("id", "vendableId", "type", "url", "metadata", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          item.id,
          id,
          item.type,
          item.url,
          JSON.stringify(item.metadata ?? {}),
          now,
        ],
      );
    }

    // Characteristics: attributes + specifications through the feature catalog.
    await this.writeAttributes(tx, id, vendable.characteristics.attributes);
    for (const [rawGroup, specs] of Object.entries(
      vendable.characteristics.specifications ?? {},
    )) {
      const group = normalizeFeatureCode(rawGroup);
      if (!group) continue;
      await this.ensureGroup(tx, `spec:${group}`, `Specifications ${group}`);
      if (specs !== null && typeof specs === "object" && !Array.isArray(specs)) {
        for (const [rawKey, value] of Object.entries(
          specs as Record<string, unknown>,
        )) {
          const key = normalizeFeatureCode(rawKey);
          if (!key) continue;
          await this.writeValue(
            tx,
            id,
            `spec:${group}`,
            `${group}.${key}`,
            value,
          );
        }
      } else {
        await this.writeValue(tx, id, `spec:${group}`, group, specs);
      }
    }

    // Variants (+ their descriptive features, shared catalog).
    for (const variant of vendable.variants) {
      const variantName =
        variant.content?.["fr"]?.name ??
        Object.values(variant.content ?? {})[0]?.name ??
        variant.reference;
      await tx.execute(
        `INSERT INTO "portfolio"."variants" ("id", "vendableId", "sku", "name", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [variant.id, id, variant.reference, variantName, now, now],
      );
      for (const [rawKey, value] of Object.entries(
        variant.characteristics?.attributes ?? {},
      )) {
        // Contrat d'entree propose/CSV : attributs de variante en texte.
        // 'T' systematique pour un round-trip exact (pas de coercition N).
        // Tableaux : meme joint ", " que les features vendable (ADR-0018).
        const key = normalizeFeatureCode(rawKey);
        if (!key) continue;
        await this.ensureFeature(tx, key, "variant", "T");
        const textValue = Array.isArray(value)
          ? value.map(String).join(", ")
          : String(value);
        await tx.execute(
          `INSERT INTO "portfolio"."variant_features" ("variantId", "featureId", "valueText")
           SELECT $1, f."id", $2 FROM "portfolio"."features" AS f WHERE f."code" = $3`,
          [variant.id, textValue, key],
        );
      }
    }

    // Variation groups rebuilt from the options block (ADR-0019) : un
    // groupe par cle d'option. Axes SKU (modeling mentionnant 'variante') :
    // lies aux features de variantes a valeurs distinctes (purpose
    // 'variation'). Autres axes (coloris, poids...) : lies a leur feature
    // enumeree `options.{cle}.values` quand elle existe (purpose 'option').
    const options = vendable.characteristics.attributes?.["options"];
    if (options !== null && typeof options === "object" && !Array.isArray(options)) {
      const distinct = new Map<string, Set<string>>();
      for (const variant of vendable.variants) {
        for (const [rawKey, value] of Object.entries(
          variant.characteristics?.attributes ?? {},
        )) {
          const key = normalizeFeatureCode(rawKey);
          if (!key) continue;
          if (!distinct.has(key)) distinct.set(key, new Set());
          distinct.get(key)?.add(String(value));
        }
      }
      for (const [rawKey, option] of Object.entries(
        options as Record<string, unknown>,
      )) {
        const key = normalizeFeatureCode(rawKey);
        if (!key) continue;
        const modeling =
          typeof option === "object" && option !== null
            ? String(
                (option as Record<string, unknown>)["modeling"] ?? "",
              ).toLowerCase()
            : "";
        const groupId = `vg_${slugify(id)}_${slugify(key)}`;
        await tx.execute(
          `INSERT INTO "portfolio"."variation_groups" ("id", "parentVendableId", "code", "createdAt")
           VALUES ($1, $2, $3, $4)`,
          [groupId, id, key, now],
        );
        if (modeling.includes("variante")) {
          for (const [featureCode, values] of distinct) {
            if (values.size < 2) continue;
            await tx.execute(
              `INSERT INTO "portfolio"."variation_group_features" ("id", "groupId", "featureId", "purpose")
               SELECT $1, $2, f."id", $3 FROM "portfolio"."features" AS f WHERE f."code" = $4`,
              [`vgf_${slugify(id)}_${slugify(key)}_${slugify(featureCode)}`, groupId, "variation", featureCode],
            );
          }
        } else {
          await tx.execute(
            `INSERT INTO "portfolio"."variation_group_features" ("id", "groupId", "featureId", "purpose")
             SELECT $1, $2, f."id", $3 FROM "portfolio"."features" AS f WHERE f."code" = $4`,
            [`vgf_${slugify(id)}_${slugify(key)}`, groupId, "option", `options.${key}.values`],
          );
        }
      }
    }

    // Relations (metadata has no normalized home — ADR-0018).
    for (const relation of vendable.relations) {
      await tx.execute(
        `INSERT INTO "portfolio"."relations" ("id", "sourceVendableId", "targetVendableId", "relationType", "createdAt")
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), id, relation.targetId, relation.type, now],
      );
    }
  }

  private async writeAttributes(
    tx: DatabaseConnection,
    vendableId: string,
    attributes: Record<string, unknown>,
  ): Promise<void> {
    await this.ensureGroup(tx, "attributes", "Attributs descriptifs");
    for (const [rawKey, value] of Object.entries(attributes)) {
      const key = normalizeFeatureCode(rawKey);
      if (!key) continue;
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        const group = `attr:${key}`;
        await this.ensureGroup(tx, group, `Bloc ${key}`);
        for (const [subKey, subValue] of Object.entries(
          value as Record<string, unknown>,
        )) {
          await this.writeNested(tx, vendableId, group, [key, subKey], subValue);
        }
        continue;
      }
      await this.writeValue(tx, vendableId, "attributes", key, value);
    }
  }

  private async writeNested(
    tx: DatabaseConnection,
    vendableId: string,
    group: string,
    path: string[],
    value: unknown,
  ): Promise<void> {
    const clean = path.map(normalizeFeatureCode).filter((s) => s.length > 0);
    if (clean.length === 0) return;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const [subKey, subValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
        await this.writeNested(tx, vendableId, group, [...clean, subKey], subValue);
      }
      return;
    }
    await this.writeValue(tx, vendableId, group, clean.join("."), value);
  }

  private async writeValue(
    tx: DatabaseConnection,
    vendableId: string,
    group: string,
    code: string,
    value: unknown,
  ): Promise<void> {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      // Regle ADR-0018 (uniforme) : UNIQUE(vendableId, featureId) interdit une
      // ligne par valeur, et un lien variantId isolé serait indiscernable
      // d'un scalaire a la lecture. Tout tableau -> joint ", " + purpose
      // 'multivalue' (split a la lecture) ; les feature_variants restent le
      // vocabulaire enumere pour l'UI. Les non-primitifs n'ont pas de home
      // normalise : ignores (aucun cas recense).
      const elements = value
        .filter((element): element is string | number | boolean =>
          ["string", "number", "boolean"].includes(typeof element),
        )
        .map(String);
      if (elements.length === 0) return;
      await this.ensureFeature(tx, code, group, "E", "multivalue");
      for (const element of elements) {
        await this.ensureFeatureVariant(tx, code, element);
      }
      await tx.execute(
        `INSERT INTO "portfolio"."vendable_features" ("id", "vendableId", "featureId", "valueText", "createdAt")
         SELECT $1, $2, f."id", $3, now() FROM "portfolio"."features" AS f WHERE f."code" = $4`,
        [randomUUID(), vendableId, elements.join(", "), code],
      );
      return;
    }
    const featureType = inferFeatureType(value);
    const purpose = code === "brand" ? "brand" : "additional";
    await this.ensureFeature(tx, code, group, featureType, purpose);
    await tx.execute(
      `INSERT INTO "portfolio"."vendable_features" ("id", "vendableId", "featureId", "valueText", "createdAt")
       SELECT $1, $2, f."id", $3, now() FROM "portfolio"."features" AS f WHERE f."code" = $4`,
      [randomUUID(), vendableId, String(value), code],
    );
  }

  // ---------- read path ----------

  private async loadMany(ids: string[]): Promise<Vendable[]> {
    const out: Vendable[] = [];
    for (const id of ids) {
      const head = await this.db.query<Record<string, unknown>>(
        `SELECT id, reference, type, status, slug, "metaTitle", "metaDesc" FROM ${VENDABLES_TABLE} WHERE id = $1`,
        [id],
      );
      const row = head[0];
      if (!row) continue;
      out.push(await this.assemble(row));
    }
    return out;
  }

  private async assemble(head: Record<string, unknown>): Promise<Vendable> {
    const id = asString(head["id"]);
    const [translations, keywords, categories, tags, media, variants, assignments, variantAttrs, relations] =
      await Promise.all([
        this.db.query<Record<string, unknown>>(
          `SELECT lang, name, "shortDescription", description FROM "portfolio"."translations" WHERE "vendableId" = $1`,
          [id],
        ),
        this.db.query<Record<string, unknown>>(
          `SELECT lang, keyword FROM "portfolio"."translation_keywords" WHERE "vendableId" = $1 ORDER BY lang, keyword`,
          [id],
        ),
        this.db.query<Record<string, unknown>>(
          `SELECT c."slug" FROM "portfolio"."categories" AS c JOIN "portfolio"."vendable_categories" AS m ON m."categoryId" = c."id" WHERE m."vendableId" = $1 ORDER BY c."slug"`,
          [id],
        ),
        this.db.query<Record<string, unknown>>(
          `SELECT t."slug" FROM "portfolio"."tags" AS t JOIN "portfolio"."vendable_tags" AS m ON m."tagId" = t."id" WHERE m."vendableId" = $1 ORDER BY t."slug"`,
          [id],
        ),
        this.db.query<Record<string, unknown>>(
          `SELECT id, type, url, metadata FROM "portfolio"."media_assets" WHERE "vendableId" = $1`,
          [id],
        ),
        this.db.query<Record<string, unknown>>(
          `SELECT id, sku, name FROM "portfolio"."variants" WHERE "vendableId" = $1 ORDER BY sku`,
          [id],
        ),
        this.db.query<AssignmentRow>(
          `SELECT f."code" AS code, f."featureType" AS "featureType", f."purpose" AS "purpose", g."code" AS "groupCode",
                  vf."valueText" AS "valueText",
                  (SELECT "variant" FROM "portfolio"."feature_variants" WHERE "id" = vf."variantId") AS "enumValue"
           FROM "portfolio"."vendable_features" AS vf
           JOIN "portfolio"."features" AS f ON f."id" = vf."featureId"
           JOIN "portfolio"."feature_groups" AS g ON g."id" = f."groupId"
           WHERE vf."vendableId" = $1`,
          [id],
        ),
        this.db.query<AssignmentRow & { variantId: string }>(
          `SELECT vf."variantId" AS "variantId", f."code" AS code, f."featureType" AS "featureType", f."purpose" AS "purpose",
                  vf."valueText" AS "valueText",
                  (SELECT "variant" FROM "portfolio"."feature_variants" WHERE "id" = vf."variantValueId") AS "enumValue"
           FROM "portfolio"."variant_features" AS vf
           JOIN "portfolio"."features" AS f ON f."id" = vf."featureId"
           WHERE vf."variantId" IN (SELECT "id" FROM "portfolio"."variants" WHERE "vendableId" = $1)`,
          [id],
        ),
        this.db.query<Record<string, unknown>>(
          `SELECT "targetVendableId", "relationType" FROM "portfolio"."relations" WHERE "sourceVendableId" = $1`,
          [id],
        ),
      ]);

    const content: VendableContent = {};
    for (const tr of translations) {
      const lang = asString(tr["lang"]);
      const entry: VendableContent[string] = { name: asString(tr["name"]) };
      const shortDescription = asString(tr["shortDescription"]);
      const description = asString(tr["description"]);
      if (shortDescription) entry.shortDescription = shortDescription;
      if (description) entry.description = description;
      const langKeywords = keywords
        .filter((k) => asString(k["lang"]) === lang)
        .map((k) => asString(k["keyword"]));
      if (langKeywords.length > 0) entry.keywords = langKeywords;
      content[lang] = entry;
    }

    const attributes: Record<string, unknown> = {};
    const specifications: Record<string, unknown> = {};
    for (const row of assignments) {
      const resolved = resolveAssignmentValue(row);
      if (!resolved.present) continue;
      const value = resolved.value;
      if (row.groupCode === "attributes") {
        attributes[row.code] = value;
        continue;
      }
      if (row.groupCode.startsWith("attr:")) {
        setNested(attributes, row.code.split("."), this.mergeEnumValue(attributes, row.code.split("."), value));
        continue;
      }
      if (row.groupCode.startsWith("spec:")) {
        const groupKey = row.groupCode.slice("spec:".length);
        if (row.code === groupKey) {
          specifications[groupKey] = value;
          continue;
        }
        const rest = row.code.slice(groupKey.length + 1).split(".");
        const existing = specifications[groupKey];
        const target =
          typeof existing === "object" && existing !== null && !Array.isArray(existing)
            ? (existing as Record<string, unknown>)
            : ((specifications[groupKey] = {}), specifications[groupKey] as Record<string, unknown>);
        setNested(target, rest, this.mergeEnumValue(specifications, [groupKey, ...rest], value));
        continue;
      }
      // 'variant' group features never land in vendable_features; ignore defensively.
    }

    const variantAttrById = new Map<string, Record<string, unknown>>();
    for (const row of variantAttrs) {
      const resolved = resolveAssignmentValue(row);
      if (!resolved.present) continue;
      const value = resolved.value;
      if (!variantAttrById.has(row.variantId)) variantAttrById.set(row.variantId, {});
      (variantAttrById.get(row.variantId) as Record<string, unknown>)[row.code] = value;
    }

    const mediaItems: VendableMedia = media
      .map((m) => ({
        id: asString(m["id"]),
        type: asString(m["type"]) as VendableMedia[number]["type"],
        url: asString(m["url"]),
        metadata: asJson<Record<string, unknown>>(m["metadata"], {}),
      }))
      .sort((a, b) => {
        const pa = typeof a.metadata?.["positionIndex"] === "number" ? (a.metadata["positionIndex"] as number) : Number.MAX_SAFE_INTEGER;
        const pb = typeof b.metadata?.["positionIndex"] === "number" ? (b.metadata["positionIndex"] as number) : Number.MAX_SAFE_INTEGER;
        return pa - pb || (a.id < b.id ? -1 : 1);
      });

    const variantItems: VendableVariants = variants.map((v) => {
      const variantId = asString(v["id"]);
      return {
        id: variantId,
        reference: asString(v["sku"]),
        content: { fr: { name: asString(v["name"]) } },
        characteristics: { attributes: variantAttrById.get(variantId) ?? {} },
      };
    });

    const slug = asString(head["slug"]);
    const metaTitle = asString(head["metaTitle"]);
    const metaDesc = asString(head["metaDesc"]);

    return {
      identity: {
        id,
        reference: asString(head["reference"]),
        type: asString(head["type"]) as VendableType,
        status: asString(head["status"], "Draft") as WorkflowStatus,
      },
      content,
      characteristics: { attributes, specifications },
      classification: {
        categories: categories.map((c) => asString(c["slug"])),
        tags: tags.map((t) => asString(t["slug"])),
        collections: [],
      },
      media: mediaItems,
      variants: variantItems,
      relations: relations.map((r) => ({
        targetId: asString(r["targetVendableId"]),
        type: asString(r["relationType"]) as VendableRelations[number]["type"],
      })),
      ...(slug || metaTitle || metaDesc
        ? {
            seo: {
              slug,
              ...(metaTitle ? { metaTitle } : {}),
              ...(metaDesc ? { metaDesc } : {}),
            },
          }
        : {}),
    };
  }

  /**
   * Accumulates repeated enum assignments (arrays modeled as one row per
   * value) back into arrays; scalar assignments overwrite.
   */
  private mergeEnumValue(
    root: Record<string, unknown>,
    path: string[],
    value: unknown,
  ): unknown {
    let node: unknown = root;
    for (let i = 0; i < path.length - 1; i++) {
      const step = path[i] as string;
      const holder = (node as Record<string, unknown>)[step];
      if (Array.isArray(holder)) return [...holder, value];
      if (typeof holder !== "object" || holder === null) return value;
      node = holder;
    }
    const leaf = path[path.length - 1] as string;
    const current = (node as Record<string, unknown>)[leaf];
    if (current === undefined) return value;
    if (Array.isArray(current)) return [...current, value];
    return [current, value];
  }
}
