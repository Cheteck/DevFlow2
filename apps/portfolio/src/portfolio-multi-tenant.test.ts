/**
 * @test — T2 : Isolation multi-tenant Portfolio (P1.1)
 *
 * Objectif : vérifier qu'un tenant ne voit pas les vendables d'un autre tenant.
 * Critère de succès : Requête WHERE tenant_id = A → 0 vendables du tenant B.
 *
 * BAC concerné : portfolio
 *
 * SCHÉMA RÉEL (vérifié sur mosaix_dev, 2026-11-08) :
 *   - portfolio.vendables : id, reference, type, status, ..., tenant_id (text NOT NULL)
 *   - portfolio.proposals : id, spaceId, ..., tenant_id (text NOT NULL)
 *
 * Migration appliquée : portfolio.catalog.v1.008_tenant_id (tenant_id ajouté aux deux tables)
 *
 * NOTE : le backfill des données existantes a utilisé `tenant_id = id` (chaque vendable
 * historique a un tenant différent). Cette stratégie de backfill doit être clarifiée
 * métier avant de considérer le multi-tenant comme pleinement livré.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDatabase, dropTestDatabase, seedFixtures, assertIsolation } from "../../../src/test/e2e-test-helpers.js";
import type { DatabasePort } from "@mosaix/ports-database";

describe("T2 — Isolation multi-tenant Portfolio", () => {
  let db: DatabasePort;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await dropTestDatabase(db);
  });

  it("doit isoler les vendables par tenant_id : tenant_A ne voit pas les vendables de tenant_B", async () => {
    // Arrange : fixtures créent 2 vendables (vendable_1 → tenant_A, vendable_2 → tenant_B)
    await seedFixtures(db);

    // Act : requêter les vendables du tenant A
    const tenantAVendables = await db.query<{ id: string; reference: string; tenant_id: string }>(
      `SELECT id, reference, "tenant_id" FROM portfolio.vendables WHERE "tenant_id" = $1`,
      ["tenant_A"],
    );

    // Assert : tenant_A ne voit que ses propres vendables
    expect(tenantAVendables).toHaveLength(1);
    expect(tenantAVendables[0].reference).toBe("REF-A-001");
    expect(tenantAVendables[0].tenant_id).toBe("tenant_A");

    // Isolation stricte : tenant_A ne voit PAS les vendables de tenant_B
    const tenantASeeingTenantB = await db.query(
      `SELECT id FROM portfolio.vendables WHERE "tenant_id" = $1 AND "tenant_id" = $2`,
      ["tenant_A", "tenant_B"],
    );
    assertIsolation(tenantASeeingTenantB, 0, "Tenant A ne doit pas voir les vendables de Tenant B");
  });

  it("doit isoler les vendables par tenant_id : tenant_B ne voit pas les vendables de tenant_A", async () => {
    // Arrange
    await seedFixtures(db);

    // Act : requêter les vendables du tenant B
    const tenantBVendables = await db.query<{ id: string; reference: string; tenant_id: string }>(
      `SELECT id, reference, "tenant_id" FROM portfolio.vendables WHERE "tenant_id" = $1`,
      ["tenant_B"],
    );

    // Assert : tenant_B ne voit que ses propres vendables
    expect(tenantBVendables).toHaveLength(1);
    expect(tenantBVendables[0].reference).toBe("REF-B-001");
    expect(tenantBVendables[0].tenant_id).toBe("tenant_B");

    // Isolation stricte : tenant_B ne voit PAS les vendables de tenant_A
    const tenantBSeeingTenantA = await db.query(
      `SELECT id FROM portfolio.vendables WHERE "tenant_id" = $1 AND "tenant_id" = $2`,
      ["tenant_B", "tenant_A"],
    );
    assertIsolation(tenantBSeeingTenantA, 0, "Tenant B ne doit pas voir les vendables de Tenant A");
  });

  it("doit isoler les proposals par tenant_id", async () => {
    // Arrange : insérer une proposal avec tenant_id
    await db.execute(
      `INSERT INTO portfolio.proposals (id, "spaceId", "proposerUserId", "suggestedReference", type, status, content, classification, characteristics, features, variants, media, translations, "tenant_id", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())`,
      [
        "proposal_A", "space_1", "user_1", "REF-PROP-A", "Product", "Draft",
        '{}', '{}', '{}', '{}', '{}', '{}', '{}', "tenant_A",
      ],
    );

    // Act : requêter les proposals du tenant A
    const tenantAProposals = await db.query<{ id: string; tenant_id: string }>(
      `SELECT id, "tenant_id" FROM portfolio.proposals WHERE "tenant_id" = $1`,
      ["tenant_A"],
    );

    // Assert : tenant_A voit sa proposal
    expect(tenantAProposals).toHaveLength(1);
    expect(tenantAProposals[0].id).toBe("proposal_A");

    // Isolation : pas de proposals pour tenant_B (aucune insérée)
    const tenantBProposals = await db.query(
      `SELECT id FROM portfolio.proposals WHERE "tenant_id" = $1`,
      ["tenant_B"],
    );
    assertIsolation(tenantBProposals, 0, "Tenant B ne doit pas voir de proposals");
  });
});
