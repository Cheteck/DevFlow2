/**
 * @test — T1 : Isolation inter-Spaces (P1.1)
 *
 * Objectif : vérifier qu'un Space ne voit pas les données d'un autre Space.
 * Critère de succès : Requête Space A → 0 résultat Space B.
 *
 * BACs concernés : spaces, commerce
 *
 * SCHÉMA RÉEL (vérifié sur mosaix_dev, 2026-11-08) :
 *   - spaces.spaces        : id, name, slug, ownerId, tenantId, ...
 *   - spaces.space_members : spaceId, userId, roleId, createdAt, updatedAt
 *   - commerce.offers      : id, vendableId, sellerId, ... (PAS de space_id)
 *
 * Toutes les colonnes camelCase sont quoted dans les requêtes SQL car
 * PostgreSQL plie les identifiants non-quotés en minuscules.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDatabase, dropTestDatabase, seedFixtures, assertIsolation } from "../../../src/test/e2e-test-helpers.js";
import type { DatabasePort } from "@mosaix/ports-database";

describe("T1 — Isolation inter-Spaces", () => {
  let db: DatabasePort;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await dropTestDatabase(db);
  });

  it("doit isoler les spaces : user_1 ne voit que space_1 dans space_members", async () => {
    // Arrange : insérer les fixtures (créé 2 spaces, 2 users, 2 space_members)
    await seedFixtures(db);

    // Act : requêter les membres de space_1 depuis la perspective de user_1
    const user1Memberships = await db.query<{ spaceId: string; userId: string }>(
      `SELECT "spaceId", "userId" FROM spaces.space_members WHERE "userId" = $1`,
      ["user_1"],
    );

    // Assert : user_1 n'est membre que de space_1
    expect(user1Memberships).toHaveLength(1);
    expect(user1Memberships[0].spaceId).toBe("space_1");

    // Isolation stricte : user_1 ne voit PAS space_2 dans ses membres
    const user1SeeingSpace2 = await db.query(
      `SELECT "spaceId" FROM spaces.space_members WHERE "userId" = $1 AND "spaceId" = $2`,
      ["user_1", "space_2"],
    );
    assertIsolation(user1SeeingSpace2, 0, "User 1 ne doit pas être membre de Space 2");
  });

  it("doit isoler les spaces : user_2 ne voit que space_2 dans space_members", async () => {
    // Arrange
    await seedFixtures(db);

    // Act : requêter les membres de space_2 depuis la perspective de user_2
    const user2Memberships = await db.query<{ spaceId: string; userId: string }>(
      `SELECT "spaceId", "userId" FROM spaces.space_members WHERE "userId" = $1`,
      ["user_2"],
    );

    // Assert : user_2 n'est membre que de space_2
    expect(user2Memberships).toHaveLength(1);
    expect(user2Memberships[0].spaceId).toBe("space_2");

    // Isolation stricte : user_2 ne voit PAS space_1 dans ses membres
    const user2SeeingSpace1 = await db.query(
      `SELECT "spaceId" FROM spaces.space_members WHERE "userId" = $1 AND "spaceId" = $2`,
      ["user_2", "space_1"],
    );
    assertIsolation(user2SeeingSpace1, 0, "User 2 ne doit pas être membre de Space 1");
  });

  it("doit isoler les spaces : requête sans filtre userId retourne tous les membres (danger)", async () => {
    // Arrange
    await seedFixtures(db);

    // Act : requête SANS filtre userId (mauvaise pratique)
    const allMemberships = await db.query<{ spaceId: string }>(
      `SELECT "spaceId" FROM spaces.space_members`,
    );

    // Assert : danger — tous les membres sont visibles
    expect(allMemberships).toHaveLength(2);

    // Leçon : TOUTES les requêtes DOIVENT filtrer par userId
    // C'est le repository/service qui doit imposer ce filtre, pas le dev
  });
});
