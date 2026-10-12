/**
 * Garde-fou ADR-0018 : le repository normalise ne doit jamais emettre un
 * INSERT dont la liste de colonnes et la liste d'expressions divergent
 * ("INSERT has more target columns than expressions" a bloque l'import
 * GSMArena en masse). Fake DatabasePort qui valide l'arite de chaque
 * INSERT (scan depth-aware, blocs $$...$$ et quotes honores) + jeu de
 * reponses programmees pour prouver l'assemblage document.
 */
import { describe, expect, it } from "vitest";
import { PostgresVendableRepository } from "./postgres-vendable-repository.js";
import { normalizeFeatureCode } from "../domain/product-options.js";
import type { Vendable } from "../domain/vendable.js";

function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  let i = 0;
  const push = (): void => {
    parts.push(current);
    current = "";
  };
  while (i < body.length) {
    const rest = body.slice(i);
    if (rest.startsWith("$$")) {
      const end = body.indexOf("$$", i + 2);
      current += end < 0 ? rest : body.slice(i, end + 2);
      i = end < 0 ? body.length : end + 2;
      continue;
    }
    const ch = body[i] as string;
    if (ch === "'") {
      let j = i + 1;
      let lit = "'";
      while (j < body.length) {
        if (body[j] === "'") {
          if (body[j + 1] === "'") {
            lit += "''";
            j += 2;
            continue;
          }
          lit += "'";
          j += 1;
          break;
        }
        lit += body[j];
        j += 1;
      }
      current += lit;
      i = j;
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      push();
    } else {
      current += ch;
    }
    i += 1;
  }
  push();
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

function assertInsertArity(sql: string): void {
  const upper = sql.toUpperCase();
  if (!upper.includes("INSERT INTO")) return;
  const colsMatch = sql.match(/INSERT INTO\s+\S+\s*\(([^]*)\)\s*(VALUES|SELECT)/i);
  if (!colsMatch?.[1]) return;
  const columns = splitTopLevel(colsMatch[1] as string);
  // colsMatch[0] se termine PAR le mot VALUES|SELECT : rest commence apres.
  const rest = sql.slice((colsMatch[0] as string).length + (colsMatch.index ?? 0));
  const isValues = /^values$/i.test(colsMatch[2] as string);
  let expressions: string[];
  if (isValues) {
    // Tuple VALUES potentiellement multi-lignes : scanne jusqu'a la
    // parenthese fermante equilibree (dollar-quoting et quotes honores).
    const body = rest;
    const open = body.indexOf("(");
    let depth = 0;
    let k = open;
    let inDollar = false;
    let inQuote: string | null = null;
    let close = -1;
    while (k < body.length) {
      const two = body.slice(k, k + 2);
      if (!inQuote && two === "$$") {
        inDollar = !inDollar;
        k += 2;
        continue;
      }
      const ch = body[k] as string;
      if (!inDollar) {
        if (inQuote) {
          if (ch === inQuote) inQuote = null;
        } else if (ch === "'") {
          inQuote = ch;
        } else if (ch === "(") {
          depth += 1;
        } else if (ch === ")") {
          depth -= 1;
          if (depth === 0) {
            close = k;
            break;
          }
        }
      }
      k += 1;
    }
    if (open < 0 || close < 0) return;
    expressions = splitTopLevel(body.slice(open + 1, close));
  } else {
    // SELECT ... FROM au niveau 0 (les FROM des sous-requetes sont ignores).
    const afterSelect = rest.replace(/^\s*SELECT\s*/i, "");
    let depth = 0;
    let cut = afterSelect.length;
    let k = 0;
    let inDollar = false;
    let inQuote: string | null = null;
    while (k < afterSelect.length) {
      const two = afterSelect.slice(k, k + 2);
      if (!inQuote && two === "$$") {
        inDollar = !inDollar;
        k += 2;
        continue;
      }
      const ch = afterSelect[k] as string;
      if (!inDollar) {
        if (inQuote) {
          if (ch === inQuote) inQuote = null;
        } else if (ch === "'") {
          inQuote = ch;
        } else if (ch === "(") depth += 1;
        else if (ch === ")") depth -= 1;
        else if (
          depth === 0 &&
          /^FROM[\s(]/i.test(afterSelect.slice(k))
        ) {
          cut = k;
          break;
        }
      }
      k += 1;
    }
    expressions = splitTopLevel(afterSelect.slice(0, cut));
  }
  expect(
    expressions.length,
    `arite INSERT (${columns.length} colonnes) : ${sql.slice(0, 160)}`,
  ).toBe(columns.length);
}

interface CannedDb {
  statements: string[];
}

function makeFakeDb(
  canned: Array<{ match: RegExp; rows: Record<string, unknown>[] }>,
  seen: CannedDb,
): {
  capabilities: { dialect: "postgres"; transactions: true; lock: object };
  query: (sql: string, params?: readonly unknown[]) => Promise<Record<string, unknown>[]>;
  execute: (sql: string, params?: readonly unknown[]) => Promise<number>;
  transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
  acquireMigrationLock: () => Promise<{ release: () => Promise<void> }>;
} {
  const tx = {
    query: async (
      sql: string,
      _params?: readonly unknown[],
    ): Promise<Record<string, unknown>[]> => {
      seen.statements.push(sql);
      assertInsertArity(sql);
      for (const c of canned) {
        if (c.match.test(sql)) return c.rows;
      }
      return [];
    },
    execute: async (
      sql: string,
      _params?: readonly unknown[],
    ): Promise<number> => {
      seen.statements.push(sql);
      assertInsertArity(sql);
      return 1;
    },
  };
  return {
    capabilities: {
      dialect: "postgres",
      transactions: true,
      lock: {},
    },
    query: (sql, params) => tx.query(sql, params),
    execute: (sql, params) => tx.execute(sql, params),
    transaction: async <T>(fn: (t: unknown) => Promise<T>): Promise<T> =>
      fn(tx),
    acquireMigrationLock: async () => ({ release: async () => {} }),
  };
}

function sampleVendable(): Vendable {
  return {
    identity: {
      id: "vend_test_1",
      reference: "TEST-1",
      type: "Product",
      status: "Draft",
    },
    content: {
      fr: {
        name: "Test Phone",
        shortDescription: "Court",
        description: "Longue description",
        keywords: ["test", "phone"],
      },
    },
    characteristics: {
      attributes: {
        brand: "TestBrand",
        battery_mAh: 5000,
        waterproof: false,
        color_options: ["Black", "White"],
        options: { color: { values: ["Black", "White"] } },
      },
      specifications: {
        body: { weight: "200 g" },
        camera_video: "4K@30",
      },
    },
    classification: {
      categories: ["smartphones"],
      tags: ["test"],
      collections: [],
    },
    media: [
      {
        id: "media_1",
        type: "image",
        url: "https://example.com/a.jpg",
        metadata: { role: "primary", positionIndex: 1 },
      },
      {
        id: "media_0",
        type: "image",
        url: "https://example.com/b.jpg",
        metadata: { role: "gallery", positionIndex: 0 },
      },
    ],
    variants: [
      {
        id: "var_1",
        reference: "TEST-1-256-12",
        content: { fr: { name: "256 Go" } },
        characteristics: { attributes: { storage_gb: "256" } },
      },
    ],
    relations: [{ targetId: "vend_other", type: "alternative_to" }],
    seo: { slug: "test-1" },
  };
}

describe("PostgresVendableRepository normalise (ADR-0018)", () => {
  it("ecrit une fiche complete sans erreur d'arite INSERT", async () => {
    const seen: CannedDb = { statements: [] };
    const db = makeFakeDb([], seen);
    const repo = new PostgresVendableRepository(
      db as never,
    );
    await repo.save(sampleVendable());
    const inserts = seen.statements.filter((s) =>
      /INSERT INTO/i.test(s),
    );
    // Tete + traduction + keywords(2) + categorie + mapping + tag + mapping
    // + 2 media + ~10 features + fvars + ~10 assignments + variante +
    // attributs + groupe de variation.
    expect(inserts.length).toBeGreaterThan(15);
  });

  it("reassemble le document depuis les tables normalisees", async () => {
    const seen: CannedDb = { statements: [] };
    const head = {
      id: "vend_test_1",
      reference: "TEST-1",
      type: "Product",
      status: "Draft",
      slug: "test-1",
      metaTitle: null,
      metaDesc: null,
    };
    const db = makeFakeDb(
      [
        {
          match: /FROM "portfolio"\."vendables" WHERE id/,
          rows: [head],
        },
        {
          match: /FROM "portfolio"\."translations" WHERE/,
          rows: [
            {
              lang: "fr",
              name: "Test Phone",
              shortDescription: "Court",
              description: "Longue description",
            },
          ],
        },
        { match: /translation_keywords/, rows: [{ lang: "fr", keyword: "test" }] },
        {
          match: /vendable_categories/,
          rows: [{ slug: "smartphones" }],
        },
        { match: /vendable_tags/, rows: [{ slug: "test" }] },
        {
          match: /FROM "portfolio"\."media_assets"/,
          rows: [
            {
              id: "media_1",
              type: "image",
              url: "https://example.com/a.jpg",
              metadata: { role: "primary", positionIndex: 1 },
            },
          ],
        },
        {
          // Avant "variants" : la requete variant_features contient la
          // sous-requete variants en collision (premier match gagne).
          match: /FROM "portfolio"\."variant_features"/,
          rows: [
            {
              variantId: "var_1",
              code: "storage_gb",
              featureType: "T",
              purpose: "additional",
              valueText: "256",
              enumValue: null,
            },
          ],
        },
        {
          match: /FROM "portfolio"\."variants" WHERE/,
          rows: [{ id: "var_1", sku: "TEST-1-256-12", name: "256 Go" }],
        },
        {
          match: /FROM "portfolio"\."vendable_features"/,
          rows: [
            {
              code: "brand",
              featureType: "T",
              groupCode: "attributes",
              purpose: "additional",
              valueText: "TestBrand",
              enumValue: null,
            },
            {
              code: "battery_mAh",
              featureType: "N",
              groupCode: "attributes",
              purpose: "additional",
              valueText: "5000",
              enumValue: null,
            },
            {
              code: "options.color.values",
              featureType: "E",
              groupCode: "attr:options",
              purpose: "multivalue",
              valueText: "Black, White",
              enumValue: null,
            },
          ],
        },
        {
          match: /FROM "portfolio"\."relations" WHERE/,
          rows: [{ targetVendableId: "vend_other", relationType: "alternative_to" }],
        },
      ],
      seen,
    );
    const repo = new PostgresVendableRepository(db as never);
    const found = await repo.findById("vend_test_1");
    expect(found?.identity.reference).toBe("TEST-1");
    expect(found?.content["fr"]?.keywords).toEqual(["test"]);
    expect(found?.characteristics.attributes["battery_mAh"]).toBe(5000);
    expect(
      (found?.characteristics.attributes["options"] as Record<string, unknown>)["color"],
    ).toEqual(
      expect.objectContaining({ values: ["Black", "White"] }),
    );
    expect(found?.variants[0]?.characteristics?.attributes).toEqual({
      storage_gb: "256",
    });
    expect(found?.media[0]?.id).toBe("media_1");
    expect(found?.seo?.slug).toBe("test-1");
    expect(found?.quality).toBeUndefined();
  });

  it("canonicalise les codes de features : aucun doublon casse/accents/espaces", () => {
    expect(normalizeFeatureCode(" Chipset ")).toBe("chipset");
    expect(normalizeFeatureCode("CHIPSET")).toBe("chipset");
    expect(normalizeFeatureCode("Écran principal")).toBe("ecran_principal");
    expect(normalizeFeatureCode("options.color.values")).toBe(
      "options.color.values",
    );
    expect(normalizeFeatureCode("!!!")).toBe("");
  });

  it("ne cree qu'une ligne de catalogue par code canonique", async () => {
    const seen: CannedDb = { statements: [] };
    const params: Array<readonly unknown[]> = [];
    const db = makeFakeDb([], seen);
    const recordingDb = {
      ...db,
      query: async (
        sql: string,
        p?: readonly unknown[],
      ): Promise<Record<string, unknown>[]> => {
        params.push(p ?? []);
        return db.query(sql, p);
      },
      execute: async (
        sql: string,
        p?: readonly unknown[],
      ): Promise<number> => {
        params.push(p ?? []);
        return db.execute(sql, p);
      },
      // La transaction du fake doit router vers les wrappers
      // enregistreurs, sinon params/seen se desalignent.
      transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> =>
        fn({
          query: async (
            sql: string,
            p?: readonly unknown[],
          ): Promise<Record<string, unknown>[]> => {
            params.push(p ?? []);
            return db.query(sql, p);
          },
          execute: async (
            sql: string,
            p?: readonly unknown[],
          ): Promise<number> => {
            params.push(p ?? []);
            return db.execute(sql, p);
          },
        }),
    };
    const repo = new PostgresVendableRepository(recordingDb as never);
    const base = sampleVendable();
    await repo.save({
      ...base,
      identity: { ...base.identity, id: "vend_dup", reference: "DUP-1" },
      characteristics: {
        attributes: {
          Chipset: "A",
          "chipset ": "B",
          CHIPSET: "C",
          Couleur: "Rouge",
          couleur: "Bleu",
        },
        specifications: {},
      },
      classification: {
        categories: ["Smart Phones", "smart_phones"],
        tags: ["5G", "5g"],
        collections: [],
      },
    });
    // Codes features emis (param $2 des INSERT features) : uniques.
    const featureCodes = seen.statements
      .map((s, i) =>
        /INSERT INTO "portfolio"\."features"/.test(s)
          ? (params[i]?.[1] as string)
          : undefined,
      )
      .filter((c): c is string => typeof c === "string");
    expect(featureCodes).toContain("chipset");
    expect(featureCodes).toContain("couleur");
    expect(new Set(featureCodes).size).toBe(featureCodes.length);
    // Categories : un seul slug canonique malgre les variantes d'ecriture.
    const catSlugs = seen.statements
      .map((s, i) =>
        /INSERT INTO "portfolio"\."categories"/.test(s)
          ? (params[i]?.[1] as string)
          : undefined,
      )
      .filter((c): c is string => typeof c === "string");
    expect(catSlugs).toEqual(["smart_phones"]);
  });

  it("distingue axes SKU (variation) et options simples (option)", async () => {
    const seen: CannedDb = { statements: [] };
    const params: Array<readonly unknown[]> = [];
    const db = makeFakeDb([], seen);
    const recordingDb = {
      ...db,
      query: async (
        sql: string,
        p?: readonly unknown[],
      ): Promise<Record<string, unknown>[]> => {
        params.push(p ?? []);
        return db.query(sql, p);
      },
      execute: async (
        sql: string,
        p?: readonly unknown[],
      ): Promise<number> => {
        params.push(p ?? []);
        return db.execute(sql, p);
      },
      transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> =>
        fn({
          query: async (
            sql: string,
            p?: readonly unknown[],
          ): Promise<Record<string, unknown>[]> => {
            params.push(p ?? []);
            return db.query(sql, p);
          },
          execute: async (
            sql: string,
            p?: readonly unknown[],
          ): Promise<number> => {
            params.push(p ?? []);
            return db.execute(sql, p);
          },
        }),
    };
    const repo = new PostgresVendableRepository(recordingDb as never);
    const base = sampleVendable();
    await repo.save({
      ...base,
      identity: { ...base.identity, id: "vend_opt", reference: "OPT-1" },
      characteristics: {
        attributes: {
          options: {
            storage: {
              modeling: "variantes SKU",
              values: ["A", "B"],
            },
            color: { label: "Coloris", values: ["Black", "White"] },
          },
        },
        specifications: {},
      },
      variants: [
        {
          id: "var_a",
          reference: "OPT-1-A",
          characteristics: { attributes: { size: "A" } },
        },
        {
          id: "var_b",
          reference: "OPT-1-B",
          characteristics: { attributes: { size: "B" } },
        },
      ],
    });
    const groups = seen.statements
      .map((s, i) =>
        /INSERT INTO "portfolio"\."variation_groups"/.test(s)
          ? (params[i]?.[2] as string)
          : undefined,
      )
      .filter((c): c is string => typeof c === "string");
    expect(groups.sort()).toEqual(["color", "storage"]);
    const purposes = seen.statements
      .map((s, i) =>
        /INSERT INTO "portfolio"\."variation_group_features"/.test(s)
          ? (params[i]?.[2] as string)
          : undefined,
      )
      .filter((c): c is string => typeof c === "string");
    expect(purposes).toContain("variation");
    expect(purposes).toContain("option");
  });
});
