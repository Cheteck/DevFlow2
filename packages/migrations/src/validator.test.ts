/**
 * @mosaix/migrations — MigrationValidator tests (Phase 04, durci Phase 07).
 *
 * Tests négatifs : les déclarations invalides doivent être rejetées,
 * jamais interprétées silencieusement.
 *
 * Le moteur n'accepte QUE des migrations TypeScript natives : les
 * déclarations SQL legacy (`content`, `down`, `kind`) sont rejetées.
 */

import { describe, it, expect } from "vitest";
import { MigrationValidator } from "./validator.js";
import type { Migration } from "./migration.js";
import type { MigrationProvider } from "./migration.js";

function migration(overrides: Partial<Migration> = {}): Migration {
  return {
    id: "bac.citadelle.identity.v1.001_create_users",
    checksum: "a1b2c3d4e5f6a7b8",
    resources: ["table:users"],
    up: async () => {},
    ...overrides,
  };
}

// ─── TypeScript natif uniquement ───

describe("Validator — TypeScript native only", () => {
  const validator = new MigrationValidator();

  it("accepte une migration TypeScript native (up + checksum)", () => {
    const result = validator.validate(migration());

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejette une migration déclarant le SQL legacy 'content'", () => {
    const result = validator.validate({
      ...migration(),
      content: "CREATE TABLE t (id TEXT);",
    } as unknown as Migration);

    expect(result.valid).toBe(false);
    expect(result.errors[0]!.message).toContain("content");
    expect(result.errors[0]!.message).toContain(
      "only accepts TypeScript native migrations",
    );
  });

  it("rejette une migration déclarant le SQL legacy 'down'", () => {
    const result = validator.validate({
      ...migration(),
      down: "DROP TABLE t;",
    } as unknown as Migration);

    expect(result.valid).toBe(false);
    expect(result.errors[0]!.message).toContain("down");
  });

  it("rejette une migration déclarant le discriminant 'kind'", () => {
    const result = validator.validate({
      ...migration(),
      kind: "sql",
    } as unknown as Migration);

    expect(result.valid).toBe(false);
    expect(result.errors[0]!.message).toContain("kind");
  });
});

// ─── Corps d'upgrade ───

describe("Validator — up body", () => {
  const validator = new MigrationValidator();

  it("rejette une migration sans fonction 'up'", () => {
    const result = validator.validate({
      ...migration(),
      up: undefined,
    } as unknown as Migration);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("'up'"))).toBe(true);
  });
});

// ─── Règles TypeScript ───

describe("Validator — TypeScript rules", () => {
  const validator = new MigrationValidator();

  it("exige un checksum explicite", () => {
    const result = validator.validate({
      ...migration(),
      checksum: undefined,
    } as unknown as Migration);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("checksum"))).toBe(
      true,
    );
  });

  it("rejette un checksum qui n'est pas un digest hexadécimal", () => {
    const result = validator.validate({
      ...migration(),
      checksum: "not-a-hex-digest",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("hexadécimal"))).toBe(
      true,
    );
  });

  it("accepte un checksum hexadécimal d'au moins 16 caractères", () => {
    const result = validator.validate({
      ...migration(),
      checksum: "a1b2c3d4e5f6a7b8c9d0e1f2",
    });

    expect(result.valid).toBe(true);
  });
});

// ─── legacyChecksums ───

describe("Validator — legacy checksums", () => {
  const validator = new MigrationValidator();

  it("accepte des checksums historiques hexadécimaux", () => {
    const result = validator.validate({
      ...migration(),
      legacyChecksums: ["227693bae95b7667"],
    });

    expect(result.valid).toBe(true);
  });

  it("rejette un checksum historique non hexadécimal", () => {
    const result = validator.validate({
      ...migration(),
      legacyChecksums: ["legacy"],
    });

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.message.includes("legacyChecksums")),
    ).toBe(true);
  });

  it("rejette le checksum courant déclaré comme checksum historique", () => {
    const result = validator.validate({
      ...migration(),
      legacyChecksums: ["a1b2c3d4e5f6a7b8"],
    });

    expect(result.valid).toBe(false);
  });
});

// ─── Dépendances ───

describe("Validator — dependencies", () => {
  const validator = new MigrationValidator();

  it("rejette une dépendance sur soi-même", () => {
    const result = validator.validate({
      ...migration(),
      dependencies: ["bac.citadelle.identity.v1.001_create_users"],
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]!.message).toContain("dépend d'elle-même");
  });

  it("accepte des dépendances externes", () => {
    const result = validator.validate({
      ...migration(),
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
    const result = validator.validate({ ...migration(), resources: [] });

    expect(result.valid).toBe(false);
    expect(result.errors[0]!.message).toContain("ne déclare aucune ressource");
  });

  it("accepte une migration avec ressources", () => {
    const result = validator.validate({
      ...migration(),
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
        checksum: "a1b2c3d4e5f6a7b8",
        up: async () => {},
        resources: ["table:users"],
      },
    ],
  };

  const providerB: MigrationProvider = {
    ownerId: () => "bac.commerce",
    migrations: () => [
      {
        id: "bac.citadelle.identity.v1.001_create_users",
        checksum: "a1b2c3d4e5f6a7b8",
        up: async () => {},
        resources: ["table:users"],
      },
    ],
  };

  it("détecte une collision d'identité entre deux providers", () => {
    const result = validator.validateNoIdentityCollision([
      providerA,
      providerB,
    ]);

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
          checksum: "a1b2c3d4e5f6a7b8",
          up: async () => {},
          resources: ["table:orders"],
        },
      ],
    };

    const result = validator.validateNoIdentityCollision([
      providerA,
      providerC,
    ]);

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

  it("pas de faux positif : même ressource déclarée une seule fois par migration", () => {
    const result = validator.validateNoResourceCollision([
      provider("bac.citadelle", [
        {
          id: "bac.citadelle.identity.v1.001_create_users",
          checksum: "a1b2c3d4e5f6a7b8",
          up: async () => {},
          resources: ["table:users"],
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
          checksum: "a1b2c3d4e5f6a7b8",
          up: async () => {},
          resources: ["table:users"],
        },
        {
          id: "bac.citadelle.identity.v1.002_add_column",
          checksum: "a1b2c3d4e5f6a7b9",
          up: async () => {},
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
          checksum: "a1b2c3d4e5f6a7b8",
          up: async () => {},
          resources: ["table:users"],
        },
      ]),
      provider("bac.commerce", [
        {
          id: "bac.commerce.shop.v1.001_create_users",
          checksum: "a1b2c3d4e5f6a7b8",
          up: async () => {},
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
          checksum: "a1b2c3d4e5f6a7b8",
          up: async () => {},
          resources: ["table:users"],
        },
      ]),
      provider("bac.commerce", [
        {
          id: "bac.commerce.shop.v1.001_create_orders",
          checksum: "a1b2c3d4e5f6a7b8",
          up: async () => {},
          resources: ["table:orders"],
        },
      ]),
    ]);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── Le SQL brut est refusé ───

describe("Validator — refus du SQL brut", () => {
  const validator = new MigrationValidator();

  it("rejette une migration déclarant un `rawSql`", () => {
    const result = validator.validate({
      ...migration(),
      rawSql: [
        {
          sql: "ALTER TABLE t ADD COLUMN x INT;",
          params: [],
          dialect: "sqlite",
        },
      ],
    } as unknown as Parameters<typeof validator.validate>[0]);

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) =>
        e.message.includes("TypeScript native migrations"),
      ),
    ).toBe(true);
  });

  it("rejette une migration déclarant un `downRawSql`", () => {
    const result = validator.validate({
      ...migration(),
      downRawSql: [{ sql: "DROP TABLE t;", params: [], dialect: "sqlite" }],
    } as unknown as Parameters<typeof validator.validate>[0]);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("downRawSql"))).toBe(
      true,
    );
  });

  it("rejette une migration déclarant l'ancien champ `content`", () => {
    const result = validator.validate({
      ...migration(),
      content: "CREATE TABLE users (id TEXT);",
    } as unknown as Parameters<typeof validator.validate>[0]);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("content"))).toBe(true);
  });

  it("accepte une migration TypeScript native sans aucun champ SQL", () => {
    const result = validator.validate({
      ...migration(),
      up: () => {},
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
