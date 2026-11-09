/**
 * @mosaix/migrations — MigrationValidator tests (Phase 04).
 *
 * Tests négatifs : les déclarations invalides doivent être rejetées,
 * jamais interprétées silencieusement.
 */

import { describe, it, expect } from "vitest";
import { MigrationValidator } from "./validator.js";
import type { Migration } from "./migration.js";
import type { MigrationProvider } from "./migration.js";

function migration(overrides: Partial<Migration> = {}): Migration {
  return {
    id: "bac.citadelle.identity.v1.001_create_users",
    checksum: "abc123",
    kind: "sql",
    resources: ["table:users"],
    ...overrides,
  };
}

// ─── Mode exclusif : SQL et TypeScript ne se mélangent pas ───

describe("Validator — exclusive mode", () => {
  const validator = new MigrationValidator();

  it("rejette une migration déclarant à la fois content et up", () => {
    const result = validator.validate({
      ...migration(),
      kind: "typescript",
      content: "CREATE TABLE t (id TEXT);",
      up: async () => {},
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.message).toContain("mutuellement exclusifs");
  });

  it("accepte une migration SQL legacy (content seulement)", () => {
    const result = validator.validate({
      ...migration(),
      kind: "sql",
      content: "CREATE TABLE t (id TEXT);",
      up: undefined,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepte une migration TypeScript native (up seulement)", () => {
    const result = validator.validate({
      ...migration(),
      kind: "typescript",
      checksum: "a1b2c3d4e5f6a7b8",
      up: async () => {},
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── Règles TypeScript ───

describe("Validator — TypeScript rules", () => {
  const validator = new MigrationValidator();

  it("rejette une migration kind typescript sans up", () => {
    const result = validator.validate({
      ...migration(),
      kind: "typescript",
      checksum: "build-hash-1234",
      up: undefined,
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]!.message).toContain("ne fournit pas de fonction 'up'");
  });

  it("rejette une migration kind typescript avec content", () => {
    const result = validator.validate({
      ...migration(),
      kind: "typescript",
      checksum: "build-hash-1234",
      up: async () => {},
      content: "CREATE TABLE t (id TEXT);",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("SQL legacy 'content'"))).toBe(true);
  });

  it("exige un checksum explicite pour TypeScript", () => {
    // kind typescript avec checksum explicite valide : acceptée
    const result = validator.validate({
      ...migration(),
      kind: "typescript",
      checksum: "a1b2c3d4e5f6a7b8c9d0e1f2",
      up: async () => {},
    });

    // Une migration TypeScript avec checksum valide et up est acceptée.
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejette une migration TypeScript sans checksum", () => {
    const result = validator.validate({
      ...migration(),
      kind: "typescript",
      checksum: undefined,
      up: async () => {},
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("checksum"))).toBe(true);
  });
});

// ─── Dépendances ───

describe("Validator — dependencies", () => {
  const validator = new MigrationValidator();

  it("rejette une dépendance sur soi-même", () => {
    const result = validator.validate({
      ...migration(),
      kind: "sql",
      content: "CREATE TABLE t (id TEXT);",
      dependencies: ["bac.citadelle.identity.v1.001_create_users"],
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]!.message).toContain("dépend d'elle-même");
  });

  it("accepte des dépendances externes", () => {
    const result = validator.validate({
      ...migration(),
      kind: "sql",
      content: "CREATE TABLE t (id TEXT);",
      dependencies: ["framework.core.schema.v1.001_bootstrap"],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── Ressources ───

describe("Validator — resources", () => {
  const validator = new MigrationValidator();

  it("rejette une migration sans ressources", () => {
    const result = validator.validate({
      ...migration(),
      kind: "sql",
      content: "CREATE TABLE t (id TEXT);",
      resources: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]!.message).toContain("ne déclare aucune ressource");
  });

  it("accepte une migration avec ressources", () => {
    const result = validator.validate({
      ...migration(),
      kind: "sql",
      content: "CREATE TABLE t (id TEXT);",
      resources: ["table:users", "index:users.email"],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── Collision d'identité entre providers ───

describe("Validator — identity collision between providers", () => {
  const validator = new MigrationValidator();

  const providerA: MigrationProvider = {
    ownerId: () => "bac.citadelle",
    migrations: () => [
      {
        id: "bac.citadelle.identity.v1.001_create_users",
        kind: "sql",
        content: "CREATE TABLE users (id TEXT PRIMARY KEY);",
        resources: ["table:users"],
      },
    ],
  };

  const providerB: MigrationProvider = {
    ownerId: () => "bac.commerce",
    migrations: () => [
      {
        id: "bac.citadelle.identity.v1.001_create_users",
        kind: "sql",
        content: "CREATE TABLE users (id TEXT PRIMARY KEY);",
        resources: ["table:users"],
      },
    ],
  };

  it("détecte une collision d'identité entre deux providers", () => {
    const result = validator.validateNoIdentityCollision([providerA, providerB]);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.message).toContain("conflict");
  });

  it("n détecte pas de collision si ids différents", () => {
    const providerC: MigrationProvider = {
      ownerId: () => "bac.commerce",
      migrations: () => [
        {
          id: "bac.commerce.shop.v1.001_create_orders",
          kind: "sql",
          content: "CREATE TABLE orders (id TEXT PRIMARY KEY);",
          resources: ["table:orders"],
        },
      ],
    };

    const result = validator.validateNoIdentityCollision([providerA, providerC]);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── Collision de ressources (R9) ───

describe("Validator — resource collision", () => {
  const validator = new MigrationValidator();

  function provider(
    ownerId: string,
    migrations: Migration[],
  ): MigrationProvider {
    return { ownerId: () => ownerId, migrations: () => migrations };
  }

  it("pas de faux positif : même ressource dans resources et rawSql.resources d'une même migration", () => {
    const result = validator.validateNoResourceCollision([
      provider("bac.citadelle", [
        {
          id: "bac.citadelle.identity.v1.001_create_users",
          kind: "sql",
          content: "CREATE TABLE users (id TEXT PRIMARY KEY);",
          resources: ["table:users"],
          rawSql: {
            sql: "ALTER TABLE users ADD COLUMN name TEXT;",
            params: [],
            dialect: "sqlite",
            resources: ["table:users"],
          },
        },
      ]),
    ]);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("même ressource dans deux migrations du même owner : autorisé (évolution)", () => {
    const result = validator.validateNoResourceCollision([
      provider("bac.citadelle", [
        {
          id: "bac.citadelle.identity.v1.001_create_users",
          kind: "sql",
          content: "CREATE TABLE users (id TEXT PRIMARY KEY);",
          resources: ["table:users"],
        },
        {
          id: "bac.citadelle.identity.v1.002_add_column",
          kind: "sql",
          content: "ALTER TABLE users ADD COLUMN name TEXT;",
          resources: ["table:users"],
        },
      ]),
    ]);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("même ressource dans deux owners différents : collision détectée", () => {
    const result = validator.validateNoResourceCollision([
      provider("bac.citadelle", [
        {
          id: "bac.citadelle.identity.v1.001_create_users",
          kind: "sql",
          content: "CREATE TABLE users (id TEXT PRIMARY KEY);",
          resources: ["table:users"],
        },
      ]),
      provider("bac.commerce", [
        {
          id: "bac.commerce.shop.v1.001_create_users",
          kind: "sql",
          content: "CREATE TABLE users (id TEXT PRIMARY KEY);",
          resources: ["table:users"],
        },
      ]),
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.message).toContain("table:users");
    expect(result.errors[0]!.message).toContain("collision");
  });

  it("deux ressources différentes : aucune collision", () => {
    const result = validator.validateNoResourceCollision([
      provider("bac.citadelle", [
        {
          id: "bac.citadelle.identity.v1.001_create_users",
          kind: "sql",
          content: "CREATE TABLE users (id TEXT PRIMARY KEY);",
          resources: ["table:users"],
        },
      ]),
      provider("bac.commerce", [
        {
          id: "bac.commerce.shop.v1.001_create_orders",
          kind: "sql",
          content: "CREATE TABLE orders (id TEXT PRIMARY KEY);",
          resources: ["table:orders"],
        },
      ]),
    ]);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── Matrice stricte des modes de migration ───

describe("Validator — strict mode matrix", () => {
  const validator = new MigrationValidator();

  it("accepte kind typescript avec up et checksum", () => {
    const result = validator.validate({
      id: "bac.citadelle.identity.v1.001_create_users",
      kind: "typescript",
      checksum: "a1b2c3d4e5f6a7b8",
      up: async () => {},
      resources: ["table:users"],
    });
    expect(result.valid).toBe(true);
  });

  it("rejette kind typescript sans up", () => {
    const result = validator.validate({
      id: "bac.citadelle.identity.v1.001_create_users",
      kind: "typescript",
      checksum: "a1b2c3d4e5f6a7b8",
      up: undefined,
      resources: ["table:users"],
    });
    expect(result.valid).toBe(false);
  });

  it("rejette kind typescript avec content", () => {
    const result = validator.validate({
      id: "bac.citadelle.identity.v1.001_create_users",
      kind: "typescript",
      checksum: "a1b2c3d4e5f6a7b8",
      up: async () => {},
      content: "CREATE TABLE t (id TEXT);",
      resources: ["table:users"],
    });
    expect(result.valid).toBe(false);
  });

  it("accepte kind sql avec content et sans up", () => {
    const result = validator.validate({
      id: "bac.citadelle.identity.v1.001_create_users",
      kind: "sql",
      content: "CREATE TABLE users (id TEXT PRIMARY KEY);",
      up: undefined,
      resources: ["table:users"],
    });
    expect(result.valid).toBe(true);
  });

  it("rejette kind sql sans content", () => {
    const result = validator.validate({
      id: "bac.citadelle.identity.v1.001_create_users",
      kind: "sql",
      content: undefined,
      up: undefined,
      resources: ["table:users"],
    });
    expect(result.valid).toBe(false);
  });

  it("rejette kind sql avec up", () => {
    const result = validator.validate({
      id: "bac.citadelle.identity.v1.001_create_users",
      kind: "sql",
      content: "CREATE TABLE users (id TEXT PRIMARY KEY);",
      up: async () => {},
      resources: ["table:users"],
    });
    expect(result.valid).toBe(false);
  });

  it("rejette typescript sans checksum", () => {
    const result = validator.validate({
      id: "bac.citadelle.identity.v1.001_create_users",
      kind: "typescript",
      checksum: undefined,
      up: async () => {},
      resources: ["table:users"],
    });
    expect(result.valid).toBe(false);
  });

  it("rejette sql avec downMigration (réservé au TypeScript)", () => {
    const result = validator.validate({
      id: "bac.citadelle.identity.v1.001_create_users",
      kind: "sql",
      content: "CREATE TABLE users (id TEXT PRIMARY KEY);",
      downMigration: async () => {},
      resources: ["table:users"],
    });
    expect(result.valid).toBe(false);
  });

  it("rejette sql avec rawSql (réservé au TypeScript)", () => {
    const result = validator.validate({
      id: "bac.citadelle.identity.v1.001_create_users",
      kind: "sql",
      content: "CREATE TABLE users (id TEXT PRIMARY KEY);",
      rawSql: {
        sql: "ALTER TABLE t ADD COLUMN x INT;",
        params: [],
        dialect: "sqlite",
      },
      resources: ["table:users"],
    });
    expect(result.valid).toBe(false);
  });
});