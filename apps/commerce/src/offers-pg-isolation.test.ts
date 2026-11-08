/**
 * @test — P0.4 : Isolation commerce PostgreSQL par space (sellerId)
 *
 * Objectif : vérifier que les offres sont isolées par sellerId (espace vendeur).
 * Critère : requête WHERE sellerId = A → 0 offres du vendeur B.
 *
 * SCHÉMA RÉEL : commerce.offers (id, vendableId, sellerId, sellerType, priceInCents, ...)
 * PAS de space_id sur offers — l'isolation se fait par sellerId.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDatabase, dropTestDatabase, seedFixtures, assertIsolation } from "../../../src/test/e2e-test-helpers.js";
import type { DatabasePort } from "@mosaix/ports-database";

describe("P0.4 — Isolation commerce PostgreSQL par sellerId", () => {
  let db: DatabasePort;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await dropTestDatabase(db);
  });

  it("isole les offres par sellerId : vendeur A ne voit pas les offres du vendeur B", async () => {
    // Arrange : seedFixtures crée 2 offres (offer_1 → sellerId=user_1, offer_2 → sellerId=user_2)
    await seedFixtures(db);

    // Act : requêter les offres du vendeur user_1
    const seller1Offers = await db.query<{ id: string; "sellerId": string; "priceInCents": number }>(
      `SELECT id, "sellerId", "priceInCents" FROM commerce.offers WHERE "sellerId" = $1`,
      ["user_1"],
    );

    // Assert : vendeur 1 ne voit que ses propres offres
    expect(seller1Offers).toHaveLength(1);
    expect(seller1Offers[0].priceInCents).toBe(1000);
    expect(seller1Offers[0].sellerId).toBe("user_1");

    // Isolation stricte : vendeur 1 ne voit PAS les offres du vendeur 2
    const seller1SeeingSeller2 = await db.query(
      `SELECT id FROM commerce.offers WHERE "sellerId" = $1 AND "sellerId" = $2`,
      ["user_1", "user_2"],
    );
    assertIsolation(seller1SeeingSeller2, 0, "Vendeur 1 ne doit pas voir les offres du Vendeur 2");
  });

  it("isole les offres par sellerId : vendeur B ne voit pas les offres du vendeur A", async () => {
    // Arrange
    await seedFixtures(db);

    // Act : requêter les offres du vendeur user_2
    const seller2Offers = await db.query<{ id: string; "sellerId": string; "priceInCents": number }>(
      `SELECT id, "sellerId", "priceInCents" FROM commerce.offers WHERE "sellerId" = $1`,
      ["user_2"],
    );

    // Assert : vendeur 2 ne voit que ses propres offres
    expect(seller2Offers).toHaveLength(1);
    expect(seller2Offers[0].priceInCents).toBe(2000);
    expect(seller2Offers[0].sellerId).toBe("user_2");

    // Isolation stricte : vendeur 2 ne voit PAS les offres du vendeur 1
    const seller2SeeingSeller1 = await db.query(
      `SELECT id FROM commerce.offers WHERE "sellerId" = $1 AND "sellerId" = $2`,
      ["user_2", "user_1"],
    );
    assertIsolation(seller2SeeingSeller1, 0, "Vendeur 2 ne doit pas voir les offres du Vendeur 1");
  });
});
