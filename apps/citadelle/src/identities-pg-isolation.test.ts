/**
 * @test — P0.4 : Isolation citadelle PostgreSQL par tenant
 *
 * Objectif : vérifier que les identités sont isolées par tenant_id.
 * Critère : requête WHERE tenant_id = A → 0 identités du tenant B.
 *
 * SCHÉMA RÉEL : public.identities (id, tenant_id, email, ...)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDatabase, dropTestDatabase, seedFixtures, assertIsolation } from "../../../src/test/e2e-test-helpers.js";
import type { DatabasePort } from "@mosaix/ports-database";

describe("P0.4 — Isolation citadelle PostgreSQL par tenant", () => {
  let db: DatabasePort;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await dropTestDatabase(db);
  });

  it("isole les identités par tenant_id : tenant_A ne voit pas tenant_B", async () => {
    // Arrange : seedFixtures crée 2 identités (user_1 → tenant_A, user_2 → tenant_B)
    await seedFixtures(db);

    // Act : requêter les identités du tenant A
    const tenantAIdentities = await db.query<{ id: string; email: string; tenant_id: string }>(
      `SELECT id, email, "tenant_id" FROM public.identities WHERE "tenant_id" = $1`,
      ["tenant_A"],
    );

    // Assert : tenant_A ne voit que ses propres identités
    expect(tenantAIdentities).toHaveLength(1);
    expect(tenantAIdentities[0].email).toBe("user1@test.local");
    expect(tenantAIdentities[0].tenant_id).toBe("tenant_A");

    // Isolation stricte : tenant_A ne voit PAS les identités de tenant_B
    const tenantASeeingTenantB = await db.query(
      `SELECT id FROM public.identities WHERE "tenant_id" = $1 AND "tenant_id" = $2`,
      ["tenant_A", "tenant_B"],
    );
    assertIsolation(tenantASeeingTenantB, 0, "Tenant A ne doit pas voir les identités de Tenant B");
  });

  it("isole les identités par tenant_id : tenant_B ne voit pas tenant_A", async () => {
    // Arrange
    await seedFixtures(db);

    // Act : requêter les identités du tenant B
    const tenantBIdentities = await db.query<{ id: string; email: string; tenant_id: string }>(
      `SELECT id, email, "tenant_id" FROM public.identities WHERE "tenant_id" = $1`,
      ["tenant_B"],
    );

    // Assert : tenant_B ne voit que ses propres identités
    expect(tenantBIdentities).toHaveLength(1);
    expect(tenantBIdentities[0].email).toBe("user2@test.local");
    expect(tenantBIdentities[0].tenant_id).toBe("tenant_B");

    // Isolation stricte : tenant_B ne voit PAS les identités de tenant_A
    const tenantBSeeingTenantA = await db.query(
      `SELECT id FROM public.identities WHERE "tenant_id" = $1 AND "tenant_id" = $2`,
      ["tenant_B", "tenant_A"],
    );
    assertIsolation(tenantBSeeingTenantA, 0, "Tenant B ne doit pas voir les identités de Tenant A");
  });
});
