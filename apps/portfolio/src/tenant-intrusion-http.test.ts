/**
 * R08 Tenant Isolation — HTTP Routes Intrusion Tests
 *
 * Objectif : vérifier qu'aucun accès cross-tenant n'est possible
 * via les routes HTTP, même avec manipulation malveillante des IDs.
 *
 * Pattern validé par ChatGPT (Martin Fowler) — 2026-11-08
 */

import { describe, expect, it, beforeEach } from "vitest";
import { Router } from "@mosaix/http";
import { PortfolioService } from "./domain/portfolio-service.js";
import { InMemoryVendableRepository } from "./infrastructure/in-memory-vendable-repository.js";
import { PortfolioController, mountPortfolioControllerRoutes } from "./infrastructure/portfolio-controller.js";
import { VendableWorkflow } from "./vendable-workflow.js";

const TENANT_ALGER = "tenant-alger";
const TENANT_ORAN = "tenant-oran";

function makePrincipal(sub: string, tenantId: string, permissions: string[] = []) {
  return { sub, tenantId, roles: ["member"], permissions };
}

// Permission strings requis par PortfolioController
// DELETE utilise PERM_CREATE (ligne 258 du controller)
const PERM_READ = "portfolio:vendable:read:tenant";
const PERM_CREATE = "portfolio:vendable:create:tenant";
const PERM_SEARCH = "portfolio:vendable:search:tenant";
const PERM_ALL = [PERM_READ, PERM_CREATE, PERM_SEARCH, "portfolio:vendable:write:tenant", "portfolio:vendable:publish:tenant"];

function makeVendable(id: string, reference: string, name: string) {
  return {
    identity: { id, reference, type: "Product" as const, status: "Active" as const },
    content: { fr: { name, shortDescription: "test", description: "test" } },
    characteristics: { attributes: { brand: "TestBrand" } },
    classification: { categories: ["test"], tags: [] },
    media: [],
    variants: [],
    relations: [],
  };
}

describe("R08 — HTTP Routes Tenant Isolation", () => {
  let router: Router;
  let repo: InMemoryVendableRepository;
  let service: PortfolioService;
  let workflow: VendableWorkflow;

  beforeEach(() => {
    repo = new InMemoryVendableRepository();
    service = new PortfolioService(repo);
    workflow = new VendableWorkflow();
    router = new Router();
    mountPortfolioControllerRoutes(router, new PortfolioController(service, repo, workflow));

    // Seed: créer des ressources dans les deux tenants
    service.createVendable(makeVendable("vnd-alger-001", "REF-ALG-001", "Produit Alger 1"), TENANT_ALGER);
    service.createVendable(makeVendable("vnd-alger-002", "REF-ALG-002", "Produit Alger 2"), TENANT_ALGER);
    service.createVendable(makeVendable("vnd-oran-001", "REF-ORA-001", "Produit Oran 1"), TENANT_ORAN);
    service.createVendable(makeVendable("vnd-oran-002", "REF-ORA-002", "Produit Oran 2"), TENANT_ORAN);
  });

  describe("GET /portfolio/catalog — isolation par tenant", () => {
    it("should return only tenant-alger vendables for user from tenant-alger", async () => {
      const res = await router.handle({
        method: "GET",
        path: "/portfolio/catalog",
        headers: {},
        principal: makePrincipal("usr-alger", TENANT_ALGER, [PERM_READ]),
      });

      expect(res.statusCode).toBe(200);
      const body = res.body as { catalog: Array<{ identity: { reference: string } }> };
      expect(body.catalog).toHaveLength(2);
      // reference est dans identity.reference (forme réelle de la réponse)
      expect(body.catalog.every(item => item.identity.reference.startsWith("REF-ALG"))).toBe(true);
    });

    it("should return only tenant-oran vendables for user from tenant-oran", async () => {
      const res = await router.handle({
        method: "GET",
        path: "/portfolio/catalog",
        headers: {},
        principal: makePrincipal("usr-oran", TENANT_ORAN, [PERM_READ]),
      });

      expect(res.statusCode).toBe(200);
      const body = res.body as { catalog: Array<{ identity: { reference: string } }> };
      expect(body.catalog).toHaveLength(2);
      expect(body.catalog.every(item => item.identity.reference.startsWith("REF-ORA"))).toBe(true);
    });

    it("should NOT leak cross-tenant vendables even with different principal", async () => {
      const resAlger = await router.handle({
        method: "GET",
        path: "/portfolio/catalog",
        headers: {},
        principal: makePrincipal("usr-alger", TENANT_ALGER, [PERM_READ]),
      });

      const resOran = await router.handle({
        method: "GET",
        path: "/portfolio/catalog",
        headers: {},
        principal: makePrincipal("usr-oran", TENANT_ORAN, [PERM_READ]),
      });

      const bodyAlger = resAlger.body as { catalog: Array<{ identity: { reference: string } }> };
      const bodyOran = resOran.body as { catalog: Array<{ identity: { reference: string } }> };

      const refsAlger = bodyAlger.catalog.map(item => item.identity.reference);
      const refsOran = bodyOran.catalog.map(item => item.identity.reference);

      // Aucune référence croisée
      expect(refsAlger.some(r => refsOran.includes(r))).toBe(false);
    });
  });

  describe("GET /portfolio/vendables/:id — isolation par ID + tenant", () => {
    it("should NOT allow tenant-alger user to read tenant-oran vendable by ID", async () => {
      const res = await router.handle({
        method: "GET",
        path: "/portfolio/vendables/vnd-oran-001",
        headers: {},
        principal: makePrincipal("usr-alger", TENANT_ALGER, [PERM_READ]),
      });

      // Guard autorise (PERM_READ ok) mais l'isolation est au niveau repository :
      // findById(id, TENANT_ALGER) → undefined → 404 (notFound)
      // Le cross-tenant échoue silencieusement : l'attaquant ne sait même pas
      // que la ressource existe dans un autre tenant.
      expect(res.statusCode).toBe(404);
    });

    it("should allow tenant-oran user to read its own vendable", async () => {
      const res = await router.handle({
        method: "GET",
        path: "/portfolio/vendables/vnd-oran-001",
        headers: {},
        principal: makePrincipal("usr-oran", TENANT_ORAN, [PERM_READ]),
      });

      expect(res.statusCode).toBe(200);
      const body = res.body as { vendable: { identity: { id: string } } };
      expect(body.vendable.identity.id).toBe("vnd-oran-001");
    });

    it("should return 404 for unknown vendable ID", async () => {
      const res = await router.handle({
        method: "GET",
        path: "/portfolio/vendables/vnd-inconnu",
        headers: {},
        principal: makePrincipal("usr-alger", TENANT_ALGER, [PERM_READ]),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /portfolio/vendables — isolation écriture", () => {
    // Le controller attend {name, type} seulement (ligne 194)
    // Il génère id, reference, status en interne
    it("should create vendable in tenant-alger when user is from tenant-alger", async () => {
      const payload = { name: "Nouveau Produit Alger", type: "Product" };

      const res = await router.handle({
        method: "POST",
        path: "/portfolio/vendables",
        headers: {},
        principal: makePrincipal("usr-alger", TENANT_ALGER, [PERM_CREATE]),
        body: payload,
      });

      expect(res.statusCode).toBe(201);
      const body = res.body as { identity: { id: string; reference: string } };
      
      // Vérifier que la ressource est bien isolée dans tenant-alger
      const found = repo.findById(body.identity.id, TENANT_ALGER);
      expect(found).toBeDefined();
      expect(found?.identity.reference).toMatch(/^REF-/);
    });

    it("should NOT create vendable in tenant-oran when user is from tenant-alger", async () => {
      const payload = { name: "Tentative intrusion", type: "Product" };

      const res = await router.handle({
        method: "POST",
        path: "/portfolio/vendables",
        headers: {},
        principal: makePrincipal("usr-alger", TENANT_ALGER, [PERM_CREATE]),
        body: payload,
      });

      expect(res.statusCode).toBe(201);
      const body = res.body as { identity: { id: string } };

      // La ressource doit être créée dans tenant-alger (tenant du principal), PAS dans tenant-oran
      const inAlger = repo.findById(body.identity.id, TENANT_ALGER);
      const inOran = repo.findById(body.identity.id, TENANT_ORAN);

      expect(inAlger).toBeDefined(); // Créé dans le bon tenant
      expect(inOran).toBeUndefined(); // Pas dans le mauvais tenant
    });
  });

  describe("DELETE /portfolio/vendables/:id — isolation suppression", () => {
    // Le controller utilise PERM_CREATE pour DELETE (ligne 258)
    // Cross-tenant retourne 403 (Guard deny), pas 404
    it("should NOT allow tenant-alger user to delete tenant-oran vendable", async () => {
      // Vérifier que la ressource existe pour Oran
      expect(repo.findById("vnd-oran-001", TENANT_ORAN)).toBeDefined();

      const res = await router.handle({
        method: "DELETE",
        path: "/portfolio/vendables/vnd-oran-001",
        headers: {},
        principal: makePrincipal("usr-alger", TENANT_ALGER, [PERM_CREATE]),
      });

      // Guard autorise (PERM_CREATE ok) mais l'isolation est au niveau repository :
      // findById(id, TENANT_ALGER) → undefined → VendableNotFoundError → 404
      // L'attaquant ne sait même pas que la ressource existe dans un autre tenant.
      expect(res.statusCode).toBe(404);

      // La ressource doit toujours exister pour Oran
      const stillExists = repo.findById("vnd-oran-001", TENANT_ORAN);
      expect(stillExists).toBeDefined();
    });

    it("should allow tenant-oran user to delete its own vendable", async () => {
      const res = await router.handle({
        method: "DELETE",
        path: "/portfolio/vendables/vnd-oran-001",
        headers: {},
        principal: makePrincipal("usr-oran", TENANT_ORAN, [PERM_CREATE]),
      });

      expect(res.statusCode).toBe(204);

      const deleted = repo.findById("vnd-oran-001", TENANT_ORAN);
      expect(deleted).toBeUndefined();
    });
  });

  describe("POST /portfolio/vendables/search — isolation recherche", () => {
    // Le controller parse body.name (SearchCriteria), pas body.query
    it("should NOT find tenant-oran vendables when searching from tenant-alger", async () => {
      const res = await router.handle({
        method: "POST",
        path: "/portfolio/vendables/search",
        headers: {},
        principal: makePrincipal("usr-alger", TENANT_ALGER, [PERM_SEARCH]),
        body: { name: "Oran" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.body as { results: unknown[] };
      expect(body.results).toHaveLength(0); // Aucun résultat Oran depuis Alger
    });

    it("should find tenant-oran vendables when searching from tenant-oran", async () => {
      const res = await router.handle({
        method: "POST",
        path: "/portfolio/vendables/search",
        headers: {},
        principal: makePrincipal("usr-oran", TENANT_ORAN, [PERM_SEARCH]),
        body: { name: "Produit" }, // "Produit Oran 1" et "Produit Oran 2" contiennent "Produit"
      });

      expect(res.statusCode).toBe(200);
      const body = res.body as { results: unknown[] };
      expect(body.results.length).toBeGreaterThanOrEqual(2); // Les 2 produits Oran
    });
  });

  describe("Principal absence — auth check", () => {
    it("should return 401 when no principal is provided", async () => {
      const res = await router.handle({
        method: "GET",
        path: "/portfolio/catalog",
        headers: {},
        // Pas de principal
      });

      expect(res.statusCode).toBe(401);
    });

    it("should return 401 for vendable read without principal", async () => {
      const res = await router.handle({
        method: "GET",
        path: "/portfolio/vendables/vnd-alger-001",
        headers: {},
        // Pas de principal
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
