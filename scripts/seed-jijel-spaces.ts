/**
 * scripts/seed-jijel-spaces.ts — Import annuaire Jijel (priorité téléphonie)
 * via les tools MCP Mosaix (`spaces_space_bulk_import`), persisté Postgres.
 *
 * Source : zone Google Maps Jijel (36.8210144, 5.7634126) — 13 magasins de
 * téléphonie collectés le 2026-10-11 (Exa Places + pagesmaghreb). Aucune
 * coordonnée inventée : les 2 fiches sans GPS (AMIR/MASTER PHONE) omettent
 * latitude/longitude.
 *
 * Usage : pnpm exec tsx scripts/seed-jijel-spaces.ts
 */
import { createPostgresDatabasePort } from "../packages/adapters/database-postgres/src/index.js";
import { MCPGateway } from "../packages/mcp/src/server/gateway.js";
import { MCPToolRegistry } from "../packages/mcp/src/tool-registry.js";
import { MCPResourceRegistry } from "../packages/mcp/src/resource-registry.js";
import { MCPPromptRegistry } from "../packages/mcp/src/prompt-registry.js";
import {
  createSpacesBACClient,
  registerSpacesTools,
} from "../packages/mcp/src/providers/spaces.js";
import { SpaceService } from "../apps/spaces/src/domain/space.model.js";
import { PostgresSpaceRepository } from "../apps/spaces/src/infrastructure/postgres-space-repository.js";

const TENANT = "jijel-dz";
const OWNER = "scraper-jijel";

interface ShopSeed {
  name: string;
  address?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  ratingsCount?: number;
  sourceUrl?: string;
}

// Zone : https://www.google.com/maps/place/Jijel/ (36.8210144, 5.7634126)
// Collecte 2026-10-11, priorité magasins de téléphonie.
const SHOPS: ShopSeed[] = [
  {
    name: "Digital Store Jijel",
    address: "N43, Jijel 18000",
    phone: "+213795949504",
    latitude: 36.814638,
    longitude: 5.771559,
    rating: 4.8,
    ratingsCount: 15,
    sourceUrl: "https://www.facebook.com/DigitalStoreJijel",
  },
  {
    name: "Mobizone",
    address: "RQ46+P58, Jijel",
    latitude: 36.806792,
    longitude: 5.760459,
    rating: 4.7,
    ratingsCount: 14,
  },
  {
    name: "Phone World Jijel",
    address: "61 Av. Abdelhamid Benbadis, Jijel 18000",
    phone: "+213658612558",
    latitude: 36.818032,
    longitude: 5.769648,
    rating: 4.0,
    ratingsCount: 4,
    sourceUrl: "http://www.instagram.com/phone_world18",
  },
  {
    name: "Mobilay Jijel",
    address: "RQ56+JR6, Av. Kaoula Mokhtar, Jijel",
    latitude: 36.80904,
    longitude: 5.762,
    rating: 5.0,
    ratingsCount: 3,
  },
  {
    name: "Dimo Phone",
    address: "RQ9C+246, Av. Abdelhamid Ben Badis, Jijel",
    phone: "+213661609190",
    latitude: 36.81753,
    longitude: 5.77026,
    rating: 3.9,
    ratingsCount: 7,
  },
  {
    name: "TechZone Jijel",
    address: "Rue Abdelhamid Ben Badis, Jijel Centre 18000",
    phone: "+213555718346",
    latitude: 36.82005,
    longitude: 5.76693,
    rating: 5.0,
    ratingsCount: 1,
  },
  {
    name: "RTL Phone",
    address: "30 Rue des Freres Khecha, Jijel",
    phone: "+213555393711",
    latitude: 36.81563,
    longitude: 5.77052,
    rating: 5.0,
    ratingsCount: 9,
  },
  {
    name: "Vivre Mobile Jijel",
    address: "55 Rue Colonel Lotfi, Jijel 18000",
    latitude: 36.820805,
    longitude: 5.763716,
    rating: 4.0,
    ratingsCount: 2,
    sourceUrl: "https://www.facebook.com/vibremobilejijel",
  },
  {
    name: "Virgin Mobile Jijel",
    address: "Av. 1er Novembre, Centre-ville, Jijel 18000",
    latitude: 36.82047,
    longitude: 5.76986,
    rating: 4.3,
    ratingsCount: 3,
  },
  {
    name: "Casa Phone Jijel",
    address: "RQ98+V7M, Jijel 18000",
    phone: "+213696116113",
    latitude: 36.81972,
    longitude: 5.76568,
    rating: 4.8,
    ratingsCount: 4,
  },
  {
    name: "Boutique AKN",
    address: "RQC7+9WX, Jijel",
    phone: "+213674061502",
    latitude: 36.820931,
    longitude: 5.764549,
  },
  {
    name: "AMIR PHONE",
    address: "Rue du 1er Novembre, Jijel",
    sourceUrl: "https://www.pagesmaghreb.com/entreprise/amir-phone-406501/jijel-24/algerie",
  },
  {
    name: "MASTER PHONE",
    address: "86 Rue Abdelhamid Ben Badis, Jijel",
    sourceUrl: "https://www.pagesmaghreb.com/entreprise/master-phone-383780/jijel-24/algerie",
  },
];

async function main(): Promise<void> {
  const url =
    process.env.MOSAIX_DATABASE_URL ?? "postgresql://mosaix:mosaix@localhost:5432/mosaix_dev";
  const db = createPostgresDatabasePort(url);
  try {
    const repository = new PostgresSpaceRepository(db);
    const service = new SpaceService(repository);

    // Même wiring que la route HTTP MCP (`src/server/routes/mcp-routes.ts`) :
    // client BAC réel → registry → gateway, appel via `tools/call`.
    const tools = new MCPToolRegistry();
    const resources = new MCPResourceRegistry();
    const prompts = new MCPPromptRegistry();
    const client = createSpacesBACClient(service);
    registerSpacesTools(tools, client);
    const gateway = new MCPGateway(tools, resources, prompts);

    const admin = {
      principal: {
        actorId: "seed-jijel",
        actorType: "agent" as const,
        tenantId: "tenant-001",
        scopes: ["mcp:admin"],
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    };

    const payload = {
      tenantId: TENANT,
      ownerId: OWNER,
      spaces: SHOPS.map((s) => ({
        name: s.name,
        template: "store",
        tenantId: TENANT,
        ownerId: OWNER,
        ...(s.address ? { address: s.address } : {}),
        ...(s.phone ? { phone: s.phone } : {}),
        ...(typeof s.latitude === "number" ? { latitude: s.latitude } : {}),
        ...(typeof s.longitude === "number" ? { longitude: s.longitude } : {}),
        ...(typeof s.rating === "number" ? { rating: s.rating } : {}),
        ...(typeof s.ratingsCount === "number" ? { ratingsCount: s.ratingsCount } : {}),
        ...(s.sourceUrl ? { sourceUrl: s.sourceUrl } : {}),
        wilaya: "Jijel",
        businessCategory: "mobile_phone_store",
      })),
    };

    const response = await gateway.handleRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "spaces_space_bulk_import", arguments: payload },
      },
      admin,
    );
    if (response?.error) {
      throw new Error(`MCP bulk import failed: ${response.error.message}`);
    }
    console.log("MCP_RESULT:" + (response?.result?.content?.[0]?.text ?? "{}"));

    // Vérification post-import via le tool de recherche (même gateway MCP).
    const verify = await gateway.handleRequest(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "spaces_space_search", arguments: { tenantId: TENANT, limit: 50 } },
      },
      admin,
    );
    console.log("MCP_VERIFY:" + (verify?.result?.content?.[0]?.text ?? "{}"));
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error("[seed-jijel-spaces] fatal:", err);
  process.exit(1);
});
