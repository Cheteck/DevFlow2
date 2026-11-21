/**
 * @ijideals/developer-portal — Canonical Application Entry Point
 *
 * Universal Developer Portal (Option C) : BAC autonome du monolithe modulaire
 * MosaiX. Périmètre initial : projection du catalogue (Discovery).
 * Voir responsibilities.md pour les frontières (BOUND).
 */

import { Container, Router, createBoundedAppBootstrap } from "@mosaix/sdk";
import { MosaixApp, RuntimeKernel, type TenantIdentity } from "@mosaix/sdk";
import type { ApplicationManifest } from "@mosaix/contracts";

import { DeveloperPortalService } from "./domain/developer-portal-service.js";
import type { CatalogRepository } from "./domain/catalog-repository.js";
import {
  mountDeveloperPortalRoutes,
  DeveloperPortalController,
} from "./infrastructure/developer-portal-controller.js";

// =============================================================
// SECTION 1 — MANIFEST
// =============================================================
export const MANIFEST = {
  type: "application",
  id: "@ijideals/developer-portal",
  name: "Universal Developer Portal",
  version: "0.1.0",
  domain: { name: "developer-portal" },
  runtime: { entrypoint: "./src/index.ts", isolation: "trusted" },
  database: { strategy: "per-app" },
  capabilities: [
    { id: "ijideals.developer-portal.resource.read", version: "1.0.0" },
    { id: "ijideals.developer-portal.publishing.submit", version: "1.0.0" },
  ],
  permissions: [
    "developer-portal:resource:read:tenant",
    "developer-portal:publishing:submit:tenant",
  ],
  events: ["ijideals.developer-portal.resource.catalog-updated"],
} as const;

// =============================================================
// SECTION 2 — ADAPTERS
// =============================================================
export interface DeveloperPortalAdapters {
  catalogRepository?: () => CatalogRepository;
}

// =============================================================
// SECTION 3 — SERVICE PROVIDER
// =============================================================
export class DeveloperPortalServiceProvider {
  constructor(private readonly adapters: DeveloperPortalAdapters = {}) {}

  register(container: Container): void {
    const repository = this.resolveRepository();
    container.instance("catalogRepository", repository);
    container.instance(
      DeveloperPortalService,
      new DeveloperPortalService(repository),
    );
  }

  async boot(container: Container, router: Router): Promise<MosaixApp> {
    const kernel = container.resolve<RuntimeKernel>("kernel");
    let tenant: TenantIdentity;
    try {
      tenant = container.resolve<TenantIdentity>("tenant");
    } catch {
      tenant = { organizationId: "default" };
    }

    const app = MosaixApp.register(
      { manifest: MANIFEST as unknown as ApplicationManifest, tenant },
      kernel,
    );

    const service = container.resolve(DeveloperPortalService);

    app.provideCapability(
      "ijideals.developer-portal.resource.read",
      async (input) => {
        const inp = (input ?? {}) as {
          id?: string;
          text?: string;
          type?: string;
        };
        if (inp.id) return service.getEntry(inp.id);
        return service.listCatalog({
          ...(inp.text ? { text: inp.text } : {}),
          ...(inp.type ? { type: inp.type as never } : {}),
        });
      },
    );

    app.provideCapability(
      "ijideals.developer-portal.publishing.submit",
      async (input) => {
        const entry = await service.projectResource(input as never);
        await app.publish(
          "ijideals.developer-portal.resource.catalog-updated",
          "1.0.0",
          {
            entryId: entry.id,
            sourceId: entry.sourceId,
            version: entry.version,
          },
        );
        return entry;
      },
    );

    mountDeveloperPortalRoutes(router, new DeveloperPortalController(service));

    return app;
  }

  private resolveRepository(): CatalogRepository {
    const repository = this.adapters.catalogRepository?.();
    if (!repository) {
      throw new Error(
        "[DeveloperPortalAdapters] catalogRepository requis : aucun fallback en mémoire hors tests.",
      );
    }
    return repository;
  }
}

// =============================================================
// SECTION 4 — BOOTSTRAP FACTORY
// =============================================================
export async function createDeveloperPortalApp(
  kernel: RuntimeKernel,
  tenant: TenantIdentity,
  adapters?: DeveloperPortalAdapters,
): Promise<{ container: Container; router: Router; app: MosaixApp }> {
  return createBoundedAppBootstrap({
    manifest: MANIFEST as unknown as ApplicationManifest,
    tenant,
    kernel,
    provider: new DeveloperPortalServiceProvider(adapters),
  });
}

// =============================================================
// SECTION 5 — DOMAIN EXPORTS
// =============================================================
export * from "./domain/catalog-entry.js";
export * from "./domain/catalog-repository.js";
export * from "./domain/developer-portal-errors.js";
export * from "./domain/developer-portal-service.js";
export * from "./infrastructure/in-memory-catalog-repository.js";
export * from "./infrastructure/developer-portal-controller.js";
export * from "./composition-root.js";
