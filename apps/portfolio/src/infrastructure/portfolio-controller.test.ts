/**
 * @apps/portfolio — HTTP Controller Tests
 * Tests for CRUD routes, authorization, domain error mapping, and publication validation.
 */

import { describe, expect, it } from "vitest";
import { Router } from "@mosaix/http";
import { PortfolioService } from "../domain/portfolio-service.js";
import { InMemoryVendableRepository } from "./in-memory-vendable-repository.js";
import { VendableWorkflow } from "../vendable-workflow.js";
import { PortfolioController, mountPortfolioControllerRoutes } from "./portfolio-controller.js";

function makePrincipal(sub: string, permissions: string[] = []): { sub: string; tenantId: string; roles?: string[]; permissions?: string[] } {
  return {
    sub,
    tenantId: "tenant_test",
    roles: ["admin"],
    permissions,
  };
}

describe("PortfolioController HTTP Routes", () => {
  it("GET /portfolio/catalog — returns 401 without principal", async () => {
    const repo = new InMemoryVendableRepository();
    const service = new PortfolioService(repo);
    const workflow = new VendableWorkflow();
    const router = new Router();
    mountPortfolioControllerRoutes(router, new PortfolioController(service, repo, workflow));

    const res = await router.handle({ method: "GET", path: "/portfolio/catalog", headers: {} });
    expect(res.statusCode).toBe(401);
  });

  it("GET /portfolio/catalog — returns catalog with principal", async () => {
    const repo = new InMemoryVendableRepository();
    const service = new PortfolioService(repo);
    const workflow = new VendableWorkflow();
    const router = new Router();
    mountPortfolioControllerRoutes(router, new PortfolioController(service, repo, workflow));

    // Seed one vendable
    await service.createVendable({
      identity: { id: "v1", reference: "REF-001", type: "Product", status: "Draft" },
      content: { fr: { name: "Test" } },
      characteristics: { attributes: {} },
      classification: {},
      media: [],
      variants: [],
      relations: [],
    });

    const res = await router.handle({
      method: "GET",
      path: "/portfolio/catalog",
      headers: {},
      principal: makePrincipal("usr_admin"),
    });
    expect(res.statusCode).toBe(200);
    expect((res.body as { catalog: unknown[] }).catalog.length).toBe(1);
  });

  it("POST /portfolio/vendables — creates vendable", async () => {
    const repo = new InMemoryVendableRepository();
    const service = new PortfolioService(repo);
    const workflow = new VendableWorkflow();
    const router = new Router();
    mountPortfolioControllerRoutes(router, new PortfolioController(service, repo, workflow));

    const res = await router.handle({
      method: "POST",
      path: "/portfolio/vendables",
      headers: {},
      principal: makePrincipal("usr_admin"),
      body: { name: "Produit Test", type: "product" },
    });
    expect(res.statusCode).toBe(201);
    const created = res.body as { identity: { id: string; reference: string } };
    expect(created.identity.id).toMatch(/^vend_/);
    expect(created.identity.reference).toMatch(/^REF-/);
  });

  it("GET /portfolio/vendables/:id — returns vendable by ID", async () => {
    const repo = new InMemoryVendableRepository();
    const service = new PortfolioService(repo);
    const workflow = new VendableWorkflow();
    const router = new Router();
    mountPortfolioControllerRoutes(router, new PortfolioController(service, repo, workflow));

    const created = await service.createVendable({
      identity: { id: "v_test_01", reference: "REF-TEST", type: "Product", status: "Draft" },
      content: { fr: { name: "Test Product" } },
      characteristics: { attributes: {} },
      classification: {},
      media: [],
      variants: [],
      relations: [],
    });

    const res = await router.handle({
      method: "GET",
      path: `/portfolio/vendables/${created.identity.id}`,
      headers: {},
      principal: makePrincipal("usr_admin"),
    });
    expect(res.statusCode).toBe(200);
    expect((res.body as { vendable: { id: string } }).vendable.identity.id).toBe("v_test_01");
  });

  it("GET /portfolio/vendables/:id — returns 404 for unknown ID", async () => {
    const repo = new InMemoryVendableRepository();
    const service = new PortfolioService(repo);
    const workflow = new VendableWorkflow();
    const router = new Router();
    mountPortfolioControllerRoutes(router, new PortfolioController(service, repo, workflow));

    const res = await router.handle({
      method: "GET",
      path: "/portfolio/vendables/v_unknown",
      headers: {},
      principal: makePrincipal("usr_admin"),
    });
    expect(res.statusCode).toBe(404);
  });

  it("PUT /portfolio/vendables/:id — updates vendable", async () => {
    const repo = new InMemoryVendableRepository();
    const service = new PortfolioService(repo);
    const workflow = new VendableWorkflow();
    const router = new Router();
    mountPortfolioControllerRoutes(router, new PortfolioController(service, repo, workflow));

    const created = await service.createVendable({
      identity: { id: "v_upd_01", reference: "REF-UPD", type: "Product", status: "Draft" },
      content: { fr: { name: "Original" } },
      characteristics: { attributes: {} },
      classification: {},
      media: [],
      variants: [],
      relations: [],
    });

    const res = await router.handle({
      method: "PUT",
      path: `/portfolio/vendables/${created.identity.id}`,
      headers: {},
      principal: makePrincipal("usr_admin"),
      body: { content: { fr: { name: "Updated Name" } } },
    });
    expect(res.statusCode).toBe(200);
    expect((res.body as { vendable: { content: { fr: { name: string } } } }).vendable.content.fr.name).toBe("Updated Name");
  });

  it("DELETE /portfolio/vendables/:id — deletes vendable", async () => {
    const repo = new InMemoryVendableRepository();
    const service = new PortfolioService(repo);
    const workflow = new VendableWorkflow();
    const router = new Router();
    mountPortfolioControllerRoutes(router, new PortfolioController(service, repo, workflow));

    const created = await service.createVendable({
      identity: { id: "v_del_01", reference: "REF-DEL", type: "Product", status: "Draft" },
      content: { fr: { name: "To Delete" } },
      characteristics: { attributes: {} },
      classification: {},
      media: [],
      variants: [],
      relations: [],
    });

    const delRes = await router.handle({
      method: "DELETE",
      path: `/portfolio/vendables/${created.identity.id}`,
      headers: {},
      principal: makePrincipal("usr_admin"),
    });
    expect(delRes.statusCode).toBe(204);

    // Verify deletion
    const getRes = await router.handle({
      method: "GET",
      path: `/portfolio/vendables/${created.identity.id}`,
      headers: {},
      principal: makePrincipal("usr_admin"),
    });
    expect(getRes.statusCode).toBe(404);
  });

  it("POST /portfolio/vendables/publish — blocks publication if completeness < 70", async () => {
    const repo = new InMemoryVendableRepository();
    const service = new PortfolioService(repo);
    const workflow = new VendableWorkflow();
    const router = new Router();
    mountPortfolioControllerRoutes(router, new PortfolioController(service, repo, workflow));

    // Create an incomplete vendable (missing description, categories, media, attributes, tags, translations)
    const incomplete = await service.createVendable({
      identity: { id: "v_incomplete", reference: "REF-INCOMPLETE", type: "Product", status: "Draft" },
      content: { fr: { name: "Incomplete Product" } }, // only name, no description
      characteristics: { attributes: {} },
      classification: { categories: [], tags: [] },
      media: [],
      variants: [],
      relations: [],
    });

    const res = await router.handle({
      method: "POST",
      path: "/portfolio/vendables/publish",
      headers: {},
      principal: makePrincipal("usr_admin"),
      body: { id: incomplete.identity.id },
    });

    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toContain("Complétude insuffisante");
  });

  it("POST /portfolio/vendables/publish — allows publication if completeness >= 70", async () => {
    const repo = new InMemoryVendableRepository();
    const service = new PortfolioService(repo);
    const workflow = new VendableWorkflow();
    const router = new Router();
    mountPortfolioControllerRoutes(router, new PortfolioController(service, repo, workflow));

    // Create a complete vendable
    const complete = await service.createVendable({
      identity: { id: "v_complete", reference: "REF-COMPLETE", type: "Product", status: "Draft" },
      content: {
        fr: { name: "Complete Product", description: "Description complète du produit." },
        en: { name: "Complete Product EN", description: "Complete product description." },
        ar: { name: "Complete Product AR", description: "وصف كامل للمنتج." },
      },
      characteristics: { attributes: { material: "Cotton" } },
      classification: { categories: ["test-category"], tags: ["test-tag"] },
      media: [{ id: "m1", type: "image", url: "https://example.com/img.jpg" }],
      variants: [],
      relations: [],
    });

    const res = await router.handle({
      method: "POST",
      path: "/portfolio/vendables/publish",
      headers: {},
      principal: makePrincipal("usr_admin"),
      body: { id: complete.identity.id },
    });

    expect(res.statusCode).toBe(200);
    const body = res.body as { vendable: { identity: { status: string } }; completeness: number };
    expect(body.vendable.identity.status).toBe("Published");
    expect(body.completeness).toBeGreaterThanOrEqual(70);
  });

  it("POST /portfolio/vendables/publish — returns 404 for unknown vendable", async () => {
    const repo = new InMemoryVendableRepository();
    const service = new PortfolioService(repo);
    const workflow = new VendableWorkflow();
    const router = new Router();
    mountPortfolioControllerRoutes(router, new PortfolioController(service, repo, workflow));

    const res = await router.handle({
      method: "POST",
      path: "/portfolio/vendables/publish",
      headers: {},
      principal: makePrincipal("usr_admin"),
      body: { id: "v_unknown" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("POST /portfolio/vendables/publish — returns 401 without principal", async () => {
    const repo = new InMemoryVendableRepository();
    const service = new PortfolioService(repo);
    const workflow = new VendableWorkflow();
    const router = new Router();
    mountPortfolioControllerRoutes(router, new PortfolioController(service, repo, workflow));

    const res = await router.handle({
      method: "POST",
      path: "/portfolio/vendables/publish",
      headers: {},
      body: { id: "v_any" },
    });
    expect(res.statusCode).toBe(401);
  });
});
