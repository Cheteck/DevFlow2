import { describe, expect, it } from "vitest";
import { Router } from "@mosaix/http";
import { DeveloperPortalService } from "./domain/developer-portal-service.js";
import { InMemoryCatalogRepository } from "./infrastructure/in-memory-catalog-repository.js";
import { DeveloperPortalController } from "./infrastructure/developer-portal-controller.js";
import { InvalidCatalogEntryError } from "./domain/developer-portal-errors.js";
import { createDeveloperPortalComposition } from "./composition-root.js";

const ENTRY = {
  sourceId: "@mosaix/portfolio",
  name: "Portfolio",
  type: "bac" as const,
  version: "1.0.0",
  description: "Catalogue & Vendables",
};

function setup() {
  const repository = new InMemoryCatalogRepository();
  const service = new DeveloperPortalService(repository);
  const controller = new DeveloperPortalController(service);
  return { repository, service, controller };
}

describe("@ijideals/developer-portal — Catalog projection", () => {
  it("projects a resource and is idempotent by sourceId", async () => {
    const { service } = setup();

    const first = await service.projectResource(ENTRY);
    const second = await service.projectResource({
      ...ENTRY,
      version: "1.1.0",
    });

    expect(second.id).toBe(first.id);
    expect(second.version).toBe("1.1.0");
    expect(await service.listCatalog()).toHaveLength(1);
  });

  it("rejects invalid type and non-semver version", async () => {
    const { service } = setup();

    await expect(
      service.projectResource({ ...ENTRY, type: "unknown" as never }),
    ).rejects.toBeInstanceOf(InvalidCatalogEntryError);

    await expect(
      service.projectResource({ ...ENTRY, version: "v1" }),
    ).rejects.toBeInstanceOf(InvalidCatalogEntryError);
  });

  it("filters the catalog by type and text", async () => {
    const { service } = setup();
    await service.projectResource(ENTRY);
    await service.projectResource({
      sourceId: "@mosaix/http",
      name: "HTTP",
      type: "package",
      version: "0.9.0",
      description: "Router et Controller",
    });

    expect(await service.listCatalog({ type: "bac" })).toHaveLength(1);
    expect(await service.listCatalog({ text: "router" })).toHaveLength(1);
  });

  it("throws when an entry is missing", async () => {
    const { service } = setup();
    await expect(service.getEntry("missing")).rejects.toThrow(/not found/i);
  });
});

describe("@ijideals/developer-portal — HTTP controller", () => {
  it("denies anonymous access with 401", async () => {
    const { controller } = setup();
    const response = await controller.listCatalog({
      method: "GET",
      path: "/developer-portal/catalog",
      headers: {},
    });
    expect(response.statusCode).toBe(401);
  });

  it("denies a principal without the permission with 403", async () => {
    const { controller } = setup();
    const response = await controller.listCatalog({
      method: "GET",
      path: "/developer-portal/catalog",
      headers: {},
      principal: { sub: "dev", tenantId: "t1", permissions: [] },
    });
    expect(response.statusCode).toBe(403);
  });

  it("returns the catalog for an authorized principal", async () => {
    const { controller, service } = setup();
    await service.projectResource(ENTRY);

    const response = await controller.listCatalog({
      method: "GET",
      path: "/developer-portal/catalog",
      headers: {},
      principal: {
        sub: "dev",
        tenantId: "t1",
        permissions: ["developer-portal:resource:read:tenant"],
      },
    });

    expect(response.statusCode).toBe(200);
    expect((response.body as { entries: unknown[] }).entries).toHaveLength(1);
  });
});

describe("@ijideals/developer-portal — Composition", () => {
  it("mounts the portal routes", () => {
    const { router } = createDeveloperPortalComposition({
      catalogRepository: () => new InMemoryCatalogRepository(),
    });
    const paths = router
      .getRoutes()
      .map((route) => `${route.method} ${route.path}`);
    expect(paths).toContain("GET /developer-portal/catalog");
    expect(paths).toContain("POST /developer-portal/catalog");
  });

  it("fails fast without an explicit catalog repository", () => {
    expect(() => createDeveloperPortalComposition()).toThrow(
      /catalogRepository requis/,
    );
  });

  it("exposes a working router instance", () => {
    const router = new Router();
    expect(router.getRoutes()).toHaveLength(0);
  });
});
