#!/usr/bin/env tsx
/**
 * Seed marketplace offers for Spaces through the REAL MCP gateway.
 *
 * Chain (all via `tools/call`, never direct service writes):
 *   spaces_space_bulk_import → portfolio_vendable_propose → commerce_offer_create
 *
 * The gateway enforces input validation (MCP-04), RBAC (MCP-03, explicit
 * seeding principal with mcp:admin) and rate limits on every call — the
 * exact path an agent would take. Idempotent: existing slugs, vendable
 * references and (seller, vendable) offers are skipped, so re-runs are safe.
 *
 * Usage:
 *   MOSAIX_DATABASE_URL=postgresql://mosaix:mosaix@localhost:5432/mosaix_dev \
 *     npx tsx scripts/seed-commerce-offers.ts
 */

import { MCPGateway } from "../packages/mcp/src/server/gateway.js";
import { MCPToolRegistry } from "../packages/mcp/src/tool-registry.js";
import { MCPResourceRegistry } from "../packages/mcp/src/resource-registry.js";
import { MCPPromptRegistry } from "../packages/mcp/src/prompt-registry.js";
import {
  createSpacesBACClient,
  registerSpacesTools,
} from "../packages/mcp/src/providers/spaces.js";
import {
  createPortfolioBACClient,
  registerPortfolioTools,
} from "../packages/mcp/src/providers/portfolio.js";
import {
  createCommerceBACClient,
  registerCommerceTools,
} from "../packages/mcp/src/providers/commerce.js";
import { PostgresDatabaseAdapter, createPgPoolClient } from "../packages/adapters/database-postgres/src/index.js";

const DATABASE_URL =
  process.env.MOSAIX_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://mosaix:mosaix@localhost:5432/mosaix_dev";

const SEED_PRINCIPAL = {
  actorId: "seed-commerce-offers",
  actorType: "service" as const,
  tenantId: "jijel-dz",
  scopes: ["mcp:admin"],
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
};

interface SeedSpace {
  name: string;
  address?: string;
  phone?: string;
  businessCategory?: string;
}

interface SeedOffer {
  spaceName: string;
  vendableReference: string;
  vendableName: string;
  vendableDescription: string;
  title: string;
  priceInCents: number;
  stockAllocation: number;
}

const SPACES: SeedSpace[] = [
  {
    name: "TechStore Jijel",
    address: "Rue de l'Indépendance, Jijel 18000",
    phone: "+213555010203",
    businessCategory: "mobile_phone_store",
  },
  { name: "Artisanat Kabyle", businessCategory: "craft_store" },
  { name: "Librairie Numidia", businessCategory: "book_store" },
];

const OFFERS: SeedOffer[] = [
  {
    spaceName: "TechStore Jijel",
    vendableReference: "XIAOMI-18-PRO-MAX",
    vendableName: "Xiaomi 18 Pro Max 5G",
    vendableDescription: "Snapdragon 8 Elite, 8500mAh, 5G — version importateur Jijel.",
    title: "Xiaomi 18 Pro Max 5G — 12/256 Go",
    priceInCents: 28900000,
    stockAllocation: 12,
  },
  {
    spaceName: "Artisanat Kabyle",
    vendableReference: "POTERIE-KABYLE-BLEUE",
    vendableName: "Poterie kabyle bleue faite main",
    vendableDescription: "Poterie traditionnelle kabyle, motifs berbères peints main.",
    title: "Poterie kabyle bleue artisanale",
    priceInCents: 650000,
    stockAllocation: 15,
  },
  {
    spaceName: "Librairie Numidia",
    vendableReference: "LIVRE-HISTOIRE-JIJEL",
    vendableName: "Histoire de Jijel — édition locale",
    vendableDescription: "Ouvrage de référence sur l'histoire de la wilaya de Jijel.",
    title: "Histoire de Jijel — édition locale",
    priceInCents: 180000,
    stockAllocation: 30,
  },
];

async function callTool(
  gateway: MCPGateway,
  id: number,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const response = await gateway.handleRequest(
    { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } },
    { principal: SEED_PRINCIPAL },
  );
  if (!response || response.error) {
    throw new Error(
      `tools/call ${name} failed: ${response?.error ? `${response.error.code} ${response.error.message}` : "no response"}`,
    );
  }
  const text = response.result?.content?.[0];
  const raw = text && typeof text === "object" && "text" in text ? String((text as { text: unknown }).text) : "{}";
  return JSON.parse(raw) as unknown;
}

async function main(): Promise<void> {
  const db = new PostgresDatabaseAdapter(createPgPoolClient(DATABASE_URL));

  const { SpaceService } = await import("../apps/spaces/src/domain/space.model.js");
  const { PostgresSpaceRepository } = await import("../apps/spaces/src/infrastructure/postgres-space-repository.js");
  const { PortfolioService } = await import("../apps/portfolio/src/domain/portfolio-service.js");
  const { PostgresVendableRepository } = await import("../apps/portfolio/src/infrastructure/postgres-vendable-repository.js");
  const { CommerceOfferService } = await import("../apps/commerce/src/domain/commerce-offer.model.js");
  const { PostgresCommerceOfferRepository } = await import("../apps/commerce/src/infrastructure/postgres-offer-repository.js");

  const tools = new MCPToolRegistry();
  const resources = new MCPResourceRegistry();
  const prompts = new MCPPromptRegistry();
  registerSpacesTools(tools, createSpacesBACClient(new SpaceService(new PostgresSpaceRepository(db))));
  registerPortfolioTools(tools, createPortfolioBACClient(new PortfolioService(new PostgresVendableRepository(db)) as never));
  registerCommerceTools(
    tools,
    createCommerceBACClient(new CommerceOfferService(new PostgresCommerceOfferRepository(db))),
  );
  void resources;
  void prompts;
  const gateway = new MCPGateway(tools, resources, prompts);

  let callId = 1;
  const stats = { spacesCreated: 0, spacesSkipped: 0, vendablesCreated: 0, vendablesSkipped: 0, offersCreated: 0, offersSkipped: 0 };

  // 1. Seller spaces (bulk import dedups by slug).
  const imported = (await callTool(gateway, callId++, "spaces_space_bulk_import", {
    tenantId: "jijel-dz",
    ownerId: "seed-marketplace",
    spaces: SPACES.map((s) => ({ ...s, template: "store" })),
  })) as { created: Array<{ id: string; name: string; slug: string }>; skipped: string[] };
  stats.spacesCreated += imported.created.length;
  stats.spacesSkipped += imported.skipped.length;

  const directory = (await callTool(gateway, callId++, "spaces_space_search", {
    tenantId: "jijel-dz",
    limit: 100,
  })) as { results: Array<{ id: string; name: string; slug: string }> };
  const spaceByName = new Map(directory.results.map((s) => [s.name, s]));

  // 2. Portfolio vendables (Draft fiches) + 3. Commerce offers.
  const existingOffers = (await callTool(gateway, callId++, "commerce_offer_list", { limit: 100 })) as {
    results: Array<{ sellerId: string; vendableId: string; title: string }>;
  };
  const existingPairs = new Set(existingOffers.results.map((o) => `${o.sellerId}::${o.vendableId}`));

  for (const item of OFFERS) {
    const space = spaceByName.get(item.spaceName);
    if (!space) throw new Error(`Seed space missing: ${item.spaceName}`);

    let vendableId: string;
    try {
      const created = (await callTool(gateway, callId++, "portfolio_vendable_propose", {
        reference: item.vendableReference,
        name: item.vendableName,
        type: "Product",
        description: item.vendableDescription,
        language: "fr",
      })) as { id: string };
      vendableId = created.id;
      stats.vendablesCreated++;
    } catch (err) {
      if (err instanceof Error && /uplicate|already exists/i.test(err.message)) {
        const found = (await callTool(gateway, callId++, "portfolio_vendable_read", {
          id: item.vendableReference,
        })) as { id: string };
        vendableId = found.id;
        stats.vendablesSkipped++;
      } else {
        throw err;
      }
    }

    if (existingPairs.has(`${space.id}::${vendableId}`)) {
      stats.offersSkipped++;
      continue;
    }
    await callTool(gateway, callId++, "commerce_offer_create", {
      sellerType: "space",
      sellerId: space.id,
      sellerName: space.name,
      vendableId,
      title: item.title,
      description: item.vendableDescription,
      priceInCents: item.priceInCents,
      currency: "DZD",
      stockAllocation: item.stockAllocation,
    });
    stats.offersCreated++;
  }

  console.log(JSON.stringify({ ok: true, ...stats }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
});
