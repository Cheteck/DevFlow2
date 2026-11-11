/**
 * @test — E2E PostgreSQL test helpers (P1.1)
 *
 * Infrastructure pour les tests d'intégration E2E :
 * - createTestDatabase() : crée les schemas + applique migrations
 * - dropTestDatabase() : DROP SCHEMA CASCADE
 * - seedFixtures() : insère tenants, spaces, users, offres, produits
 * - assertIsolation() : vérifie l'isolation (count=0 attendu)
 *
 * PostgreSQL éphémère : chaque test suite recrée les schemas.
 *
 * SCHÉMA RÉEL (vérifié sur mosaix_dev, 2026-11-08) :
 *   - spaces.spaces        : id, name, slug, ownerId, tenantId, ...
 *   - spaces.space_members : spaceId, userId, roleId, createdAt, updatedAt
 *   - commerce.offers      : id, vendableId, sellerId, sellerType, priceInCents,
 *                            currency, commissionRateBps, stockQuantity, status,
 *                            createdAt, updatedAt
 *   - portfolio.vendables  : id, reference, type, status, ..., tenant_id (text NOT NULL)
 *   - portfolio.proposals  : id, spaceId, ..., tenant_id (text NOT NULL)
 *   - public.identities    : id, tenant_id (default 'default'), email, ...
 *
 * PAS DE portfolio.tenants, PAS DE citadelle.users, PAS de space_id sur commerce.offers.
 */

import { createPostgresDatabasePort } from "@mosaix/adapter-database-postgres";
import type { DatabaseConnection, DatabasePort } from "@mosaix/ports-database";

const TEST_CONNECTION_STRING = process.env.MOSAIX_TEST_DATABASE_URL ?? "postgresql://mosaix:mosaix@localhost:5432/mosaix_test";

/**
 * Schemas BACs fondamentaux (MVP IJIDeals)
 */
const BAC_SCHEMAS = ["portfolio", "commerce", "spaces", "solara", "beam", "citadelle"] as const;

/**
 * Crée un DatabasePort de test (schema éphémère par test)
 */
export function createTestDatabasePort(): DatabasePort {
  return createPostgresDatabasePort(TEST_CONNECTION_STRING);
}

/**
 * Crée les schemas BACs et applique les migrations
 * @returns DatabasePort prêt pour les tests
 *
 * NOTE : les migrations complètes ne peuvent pas être appliquées ici car
 * `mosaix migrate` est bloqué par un bug pré-existant (collision booking.slots).
 * Les tables minimales requises pour T1/T2 sont créées manuellement ci-dessous.
 */
export async function createTestDatabase(): Promise<DatabasePort> {
  const db = createTestDatabasePort();

  try {
    // Créer les schemas (idempotent : IF NOT EXISTS gère les runs séquentiels)
    for (const schema of BAC_SCHEMAS) {
      await db.execute(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    }

    // Créer les tables minimales requises par les tests E2E (T1, T2)
    // Schéma reproduit fidèlement depuis mosaix_dev (verified 2026-11-08)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS public.identities (
        id text PRIMARY KEY,
        tenant_id text NOT NULL DEFAULT 'default',
        email text,
        display_name text,
        status text NOT NULL DEFAULT 'active',
        password_hash text,
        roles text NOT NULL DEFAULT '["member"]',
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz,
        attributes text
      );
    `);

    await db.execute(`
      DROP TABLE IF EXISTS spaces.roles CASCADE;
      CREATE TABLE spaces.roles (
        id character varying(255) PRIMARY KEY,
        "key" character varying(255) NOT NULL,
        name character varying(255) NOT NULL,
        "scopeType" character varying(50) NOT NULL,
        "scopeId" character varying(255),
        rank integer NOT NULL DEFAULT 10,
        "isSystem" boolean NOT NULL DEFAULT false,
        "inheritsFrom" character varying(255),
        "createdBy" character varying(255),
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT roles_scopeType_check CHECK ("scopeType" IN ('GLOBAL', 'SPACE'))
      );
    `);

    await db.execute(`
      DROP TABLE IF EXISTS spaces.spaces CASCADE;
      CREATE TABLE spaces.spaces (
        id character varying(255) PRIMARY KEY,
        name character varying(255) NOT NULL,
        slug character varying(255),
        category character varying(255),
        template character varying(255),
        "ownerId" character varying(255) NOT NULL,
        "tenantId" character varying(255),
        "followersCount" integer NOT NULL DEFAULT 0,
        "customDomain" character varying(255),
        "subscriptionPlan" character varying(255),
        "enabledCapabilities" jsonb,
        "publicNavigation" jsonb,
        team jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(`
      DROP TABLE IF EXISTS spaces.space_members CASCADE;
      CREATE TABLE spaces.space_members (
        "spaceId" character varying(255) NOT NULL,
        "userId" character varying(255) NOT NULL,
        "roleId" character varying(255) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("spaceId", "userId"),
        CONSTRAINT fk_space_members_roleId FOREIGN KEY ("roleId") REFERENCES spaces.roles(id) ON DELETE CASCADE,
        CONSTRAINT fk_space_members_spaceId FOREIGN KEY ("spaceId") REFERENCES spaces.spaces(id) ON DELETE CASCADE
      );
    `);

    await db.execute(`
      DROP TABLE IF EXISTS commerce.offers CASCADE;
      CREATE TABLE commerce.offers (
        id character varying(255) PRIMARY KEY,
        "vendableId" character varying(255) NOT NULL,
        "sellerId" character varying(255) NOT NULL,
        "sellerType" character varying(255) NOT NULL DEFAULT 'user',
        "priceInCents" integer NOT NULL,
        currency character varying(255) NOT NULL DEFAULT 'EUR',
        "commissionRateBps" integer NOT NULL DEFAULT 500,
        "stockQuantity" integer NOT NULL DEFAULT 1,
        status character varying(50) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(`
      DROP TABLE IF EXISTS portfolio.vendables CASCADE;
      CREATE TABLE portfolio.vendables (
        id character varying(255) PRIMARY KEY,
        reference character varying(255) NOT NULL,
        type character varying(50) NOT NULL,
        status character varying(50) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
        slug text,
        "metaTitle" text,
        "metaDesc" text,
        "tenant_id" text NOT NULL,
        CONSTRAINT uniq_vendable_reference UNIQUE (reference),
        CONSTRAINT uniq_vendable_tenant_reference UNIQUE ("tenant_id", reference),
        CONSTRAINT portfolio_vendables_status_check CHECK (status IN ('Draft', 'In Review', 'NeedsApproval', 'Scheduled', 'Validated', 'Published', 'Expired', 'Archived')),
        CONSTRAINT portfolio_vendables_type_check CHECK (type IN ('Product', 'Service', 'DigitalProduct', 'Experience'))
      );
    `);

    await db.execute(`
      DROP TABLE IF EXISTS portfolio.proposals CASCADE;
      CREATE TABLE portfolio.proposals (
        id character varying(255) PRIMARY KEY,
        "spaceId" character varying(255) NOT NULL,
        "proposerUserId" character varying(255) NOT NULL,
        "suggestedReference" character varying(255) NOT NULL,
        type character varying(255) NOT NULL,
        status character varying(255) NOT NULL,
        content jsonb NOT NULL,
        classification jsonb NOT NULL,
        characteristics jsonb NOT NULL,
        features jsonb NOT NULL,
        variants jsonb NOT NULL,
        media jsonb NOT NULL,
        translations jsonb NOT NULL,
        "tenant_id" text NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW()
      );
    `);

    return db;
  } catch (error) {
    throw error;
  }
}

/**
 * Drop les schemas BACs (cleanup après test)
 */
export async function dropTestDatabase(db: DatabasePort): Promise<void> {
  try {
    for (const schema of BAC_SCHEMAS) {
      await db.execute(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    }
  } finally {
    // DatabasePort n'expose pas de méthode close() : le cycle de vie
    // de la connexion est géré par l'adapter appelant.
  }
}

/**
 * Fixtures pour tests d'isolation
 */
export interface TestFixtures {
  tenants: Array<{ id: string; name: string }>;
  spaces: Array<{ id: string; name: string; ownerId: string }>;
  users: Array<{ id: string; email: string; tenantId: string }>;
  offers: Array<{ id: string; vendableId: string; sellerId: string; priceCents: number }>;
  vendables: Array<{ id: string; reference: string; tenantId: string; type: string; status: string }>;
}

/**
 * Insère les fixtures de base pour les tests d'isolation
 */
export async function seedFixtures(db: DatabasePort): Promise<TestFixtures> {
  const fixtures: TestFixtures = {
    tenants: [
      { id: "tenant_A", name: "Tenant A" },
      { id: "tenant_B", name: "Tenant B" },
    ],
    spaces: [
      { id: "space_1", name: "Space 1", ownerId: "user_1" },
      { id: "space_2", name: "Space 2", ownerId: "user_2" },
    ],
    users: [
      { id: "user_1", email: "user1@test.local", tenantId: "tenant_A" },
      { id: "user_2", email: "user2@test.local", tenantId: "tenant_B" },
    ],
    offers: [
      { id: "offer_1", vendableId: "vendable_1", sellerId: "user_1", priceCents: 1000 },
      { id: "offer_2", vendableId: "vendable_2", sellerId: "user_2", priceCents: 2000 },
    ],
    vendables: [
      { id: "vendable_1", reference: "REF-A-001", tenantId: "tenant_A", type: "Product", status: "Published" },
      { id: "vendable_2", reference: "REF-B-001", tenantId: "tenant_B", type: "Product", status: "Published" },
    ],
  };

  // Insérer les identités (schema public, remplace citadelle.users qui n'existe pas)
  // ON CONFLICT DO NOTHING car public n'est pas droppé entre les tests
  for (const user of fixtures.users) {
    await db.execute(
      `INSERT INTO public.identities (id, email, tenant_id, status, roles, created_at, updated_at)
       VALUES ($1, $2, $3, 'active', '["member"]', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [user.id, user.email, user.tenantId],
    );
  }

  // Insérer les spaces (schema spaces, colonnes camelCase quoted)
  for (const space of fixtures.spaces) {
    await db.execute(
      `INSERT INTO spaces.spaces (id, name, "ownerId", "tenantId", "followersCount", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 0, NOW(), NOW())`,
      [space.id, space.name, space.ownerId, space.ownerId === "user_1" ? "tenant_A" : "tenant_B"],
    );
  }

  // S'assurer qu'un rôle système existe (FK obligatoire sur space_members.roleId)
  const existingRoles = await db.query<{ id: string }>(
    `SELECT id FROM spaces.roles WHERE "isSystem" = true LIMIT 1`,
  );
  let systemRoleId = existingRoles[0]?.id;
  if (!systemRoleId) {
    await db.execute(
      `INSERT INTO spaces.roles (id, "key", name, "scopeType", rank, "isSystem", "createdAt", "updatedAt")
       VALUES ('role_system', 'system_owner', 'System Owner', 'GLOBAL', 1, true, NOW(), NOW())`,
    );
    systemRoleId = "role_system";
  }

  // Insérer les membres de space (schema spaces, colonnes camelCase quoted)
  for (const space of fixtures.spaces) {
    const ownerUser = fixtures.users.find((u) => u.id === space.ownerId);
    if (ownerUser && systemRoleId) {
      await db.execute(
        `INSERT INTO spaces.space_members ("spaceId", "userId", "roleId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [space.id, ownerUser.id, systemRoleId],
      );
    }
  }

  // Insérer les vendables (schema portfolio, colonne tenant_id requise)
  for (const vendable of fixtures.vendables) {
    await db.execute(
      `INSERT INTO portfolio.vendables (id, reference, type, status, slug, "metaTitle", "metaDesc", tenant_id, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [vendable.id, vendable.reference, vendable.type, vendable.status, vendable.reference.toLowerCase(), null, null, vendable.tenantId],
    );
  }

  // Insérer les offres (schema commerce, colonnes camelCase quoted)
  for (const offer of fixtures.offers) {
    await db.execute(
      `INSERT INTO commerce.offers (id, "vendableId", "sellerId", "sellerType", "priceInCents", currency, "commissionRateBps", "stockQuantity", status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'user', $4, 'EUR', 500, 1, 'active', NOW(), NOW())`,
      [offer.id, offer.vendableId, offer.sellerId, offer.priceCents],
    );
  }

  return fixtures;
}

/**
 * Vérifie une assertion d'isolation
 * @param query Résultat de db.query()
 * @param expectedCount Nombre attendu (0 pour isolation stricte)
 * @param message Message d'erreur personnalisé
 */
export function assertIsolation<T>(result: T[], expectedCount: number = 0, message?: string): void {
  if (result.length !== expectedCount) {
    throw new Error(
      message ??
        `Isolation violation: attendu ${expectedCount} résultat(s), obtenu ${result.length}`,
    );
  }
}

/**
 * Helper: exécute une requête et compte les résultats
 */
export async function countQuery<T = Record<string, unknown>>(
  db: DatabasePort,
  sql: string,
  params?: readonly unknown[],
): Promise<number> {
  const results = await db.query<T>(sql, params);
  return results.length;
}

/**
 * Helper: vérifie qu'une transaction fonctionne (T6)
 */
export async function testTransactionCommit<T>(
  db: DatabasePort,
  fn: (tx: DatabaseConnection) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const result = await fn(tx);
    return result;
  });
}

/**
 * Helper: vérifie qu'un rollback fonctionne (T4)
 */
export async function testTransactionRollback(
  db: DatabasePort,
  fn: (tx: DatabaseConnection) => Promise<void>,
  shouldFail: boolean = true,
): Promise<boolean> {
  let failed = false;
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      if (shouldFail) {
        throw new Error("Intentional rollback trigger");
      }
    });
  } catch {
    failed = true;
  }
  return failed === shouldFail;
}
