import { describe, expect, it } from "vitest";
import { MCPToolRegistry } from "./tool-registry.js";
import { MCPResourceRegistry } from "./resource-registry.js";
import { MCPPromptRegistry } from "./prompt-registry.js";
import { MCPGateway } from "./server/gateway.js";
import {
  registerPortfolioPrompts,
  registerPortfolioResources,
  registerPortfolioTools,
  type PortfolioBACClient,
} from "./providers/portfolio.js";

const client: PortfolioBACClient = {
  searchVendables: async (params) => {
    const all = [
      {
        id: "v1",
        reference: "REF-1",
        type: "Product",
        status: "Published",
        name: "Xiaomi 18",
      },
      {
        id: "v2",
        reference: "REF-2",
        type: "Service",
        status: "Draft",
        name: "Consultation",
      },
    ];
    return all
      .filter(
        (v) =>
          !params.query ||
          v.name.toLowerCase().includes(params.query.toLowerCase()),
      )
      .slice(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 20));
  },
  readVendable: async (idOrReference) => {
    const all = [
      {
        id: "v1",
        reference: "REF-1",
        type: "Product",
        status: "Published",
        name: "Xiaomi 18",
      },
    ];
    return all.find(
      (v) => v.id === idOrReference || v.reference === idOrReference,
    );
  },
};

describe("Deterministic Portfolio tools (MCP-01)", () => {
  it("registers nothing when the BAC client is not wired", () => {
    const tools = new MCPToolRegistry();
    registerPortfolioTools(tools);

    expect(tools.getTool("portfolio_vendable_search")).toBeUndefined();
    expect(tools.getTool("portfolio_vendable_read")).toBeUndefined();
  });

  it("searches real (injected) BAC data with an aligned permission", async () => {
    const tools = new MCPToolRegistry();
    registerPortfolioTools(tools, client);

    const tool = tools.getTool("portfolio_vendable_search");
    expect(tool?.requiredPermission).toBe("portfolio:vendable:read:tenant");

    const out = (await tool?.handler({ query: "xiaomi" })) as {
      results: Array<{ id: string }>;
      count: number;
    };
    expect(out.count).toBe(1);
    expect(out.results[0]?.id).toBe("v1");
  });

  it("reads by id or reference and reports unknown ids", async () => {
    const tools = new MCPToolRegistry();
    registerPortfolioTools(tools, client);

    const tool = tools.getTool("portfolio_vendable_read");
    const found = (await tool?.handler({ id: "REF-1" })) as { id: string };
    expect(found.id).toBe("v1");

    await expect(tool?.handler({ id: "unknown" })).rejects.toThrow("not found");
    await expect(tool?.handler({})).rejects.toThrow("Missing required 'id'");
  });

  it("exposes the portfolio://vendables collection resource with an aligned permission", async () => {
    const resources = new MCPResourceRegistry();
    registerPortfolioResources(resources, client);

    const def = resources.getResource("portfolio://vendables");
    expect(def?.requiredPermission).toBe("portfolio:vendable:read:tenant");

    const payload = (await def?.resolver("portfolio://vendables")) as {
      results: Array<{ id: string }>;
      count: number;
    };
    expect(payload.count).toBe(2);
  });

  it("registers no resource when unwired and denies anonymous resource reads", async () => {
    const resources = new MCPResourceRegistry();
    registerPortfolioResources(resources);
    expect(resources.getResource("portfolio://vendables")).toBeUndefined();

    const wired = new MCPResourceRegistry();
    registerPortfolioResources(wired, client);
    const gateway = new MCPGateway(
      new MCPToolRegistry(),
      wired,
      new MCPPromptRegistry(),
    );

    const res = await gateway.handleRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "resources/read",
      params: { uri: "portfolio://vendables" },
    });
    expect(res.error?.code).toBe(-32001);
  });

  it("provides a PIM completeness brief prompt", async () => {
    const prompts = new MCPPromptRegistry();
    registerPortfolioPrompts(prompts);

    const prompt = prompts.getPrompt("portfolio_listing_quality_brief");
    expect(prompt).toBeDefined();
    const messages = await prompt?.handler({
      reference: "REF-1",
      title: "Xiaomi 18",
    });
    expect(messages?.[0]?.content.text).toContain("REF-1");
    expect(messages?.[0]?.content.text).toContain("no price/stock");
  });
});

describe("Portfolio propose tool (MCP write seam, Draft-only)", () => {
  const writeClient: PortfolioBACClient = {
    searchVendables: async () => [],
    readVendable: async () => undefined,
    proposeVendable: async (draft) => ({
      id: draft.identity.id,
      reference: draft.identity.reference,
      type: draft.identity.type,
      status: draft.identity.status,
      name: draft.content["fr"]?.name ?? Object.values(draft.content)[0]?.name,
    }),
  };

  it("registers no propose tool for read-only clients", () => {
    const tools = new MCPToolRegistry();
    registerPortfolioTools(tools, client);

    expect(tools.getTool("portfolio_vendable_search")).toBeDefined();
    expect(tools.getTool("portfolio_vendable_propose")).toBeUndefined();
  });

  it("registers propose with the create permission when the write seam exists", () => {
    const tools = new MCPToolRegistry();
    registerPortfolioTools(tools, writeClient);

    const tool = tools.getTool("portfolio_vendable_propose");
    expect(tool?.requiredPermission).toBe("portfolio:vendable:create:tenant");
    expect(tool?.ownerApp).toBe("@apps/portfolio");
  });

  it("creates a Draft summary from GSMArena-like input", async () => {
    const tools = new MCPToolRegistry();
    registerPortfolioTools(tools, writeClient);

    const tool = tools.getTool("portfolio_vendable_propose");
    const out = (await tool?.handler({
      reference: "XIAOMI-18-PRO-MAX-5G",
      name: "Xiaomi 18 Pro Max 5G",
      type: "Product",
      description:
        "Smartphone 6.9 pouces LTPO AMOLED 120Hz, Snapdragon 8 Elite.",
      category: "smartphones",
      tags: ["5g", "xiaomi"],
      brand: "Xiaomi",
      language: "fr",
      attributes: {
        chipset: "Snapdragon 8 Elite Extreme Gen 6",
        battery_mAh: 8500,
      },
      specifications: { dimensions_mm: "163.4x77.6x8.4" },
      mediaUrls: ["https://example.com/xiaomi-18-pro-max.jpg"],
      variants: [{ name: "256GB / 12GB", sku: "XIAOMI-18PM-256-12" }],
      sourceUrl: "https://www.gsmarena.com/xiaomi_18_pro_max_5g-14958.php",
    })) as { reference: string; status: string; type: string };

    expect(out.reference).toBe("XIAOMI-18-PRO-MAX-5G");
    expect(out.status).toBe("Draft");
    expect(out.type).toBe("Product");
  });

  it("rejects invalid references, types and duplicate variant skus", async () => {
    const tools = new MCPToolRegistry();
    registerPortfolioTools(tools, writeClient);
    const tool = tools.getTool("portfolio_vendable_propose");

    await expect(
      tool?.handler({ reference: "bad ref!", name: "Xiaomi" }),
    ).rejects.toThrow("reference");
    await expect(
      tool?.handler({ reference: "REF-OK", name: "X", type: "Product" }),
    ).rejects.toThrow("name");
    await expect(
      tool?.handler({ reference: "REF-OK", name: "Xiaomi", type: "Nope" }),
    ).rejects.toThrow("type");
    await expect(
      tool?.handler({
        reference: "REF-OK",
        name: "Xiaomi",
        variants: [
          { name: "A", sku: "SKU-1" },
          { name: "B", sku: "SKU-1" },
        ],
      }),
    ).rejects.toThrow("Duplicate variant sku");
  });

  it("surfaces BAC duplicate-reference errors without swallowing them", async () => {
    const dupClient: PortfolioBACClient = {
      searchVendables: async () => [],
      readVendable: async () => undefined,
      proposeVendable: async () => {
        throw new Error(
          "Vendable with reference [XIAOMI-18-PRO-MAX-5G] already exists.",
        );
      },
    };
    const tools = new MCPToolRegistry();
    registerPortfolioTools(tools, dupClient);

    await expect(
      tools.getTool("portfolio_vendable_propose")?.handler({
        reference: "XIAOMI-18-PRO-MAX-5G",
        name: "Xiaomi 18 Pro Max 5G",
      }),
    ).rejects.toThrow("already exists");
  });
});

describe("Portfolio options tool (MCP options seam)", () => {
  const optionsClient: PortfolioBACClient = {
    searchVendables: async () => [],
    readVendable: async () => undefined,
    setProductOptions: async (vendableId, _groups) => ({
      id: vendableId,
      reference: "REF-1",
      type: "Product",
      status: "Draft",
      name: "Phone",
    }),
  };

  it("registers no options tool for clients without the seam", () => {
    const tools = new MCPToolRegistry();
    registerPortfolioTools(tools, {
      searchVendables: async () => [],
      readVendable: async () => undefined,
    });

    expect(tools.getTool("portfolio_vendable_options_set")).toBeUndefined();
  });

  it("registers options_set with the create permission and forwards groups", async () => {
    const seen: Array<{ id: string; groups: unknown }> = [];
    const tools = new MCPToolRegistry();
    registerPortfolioTools(tools, {
      searchVendables: async () => [],
      readVendable: async () => undefined,
      setProductOptions: async (vendableId, groups) => {
        seen.push({ id: vendableId, groups });
        return {
          id: vendableId,
          reference: "REF-1",
          type: "Product",
          status: "Draft",
          name: "Phone",
        };
      },
    });

    const tool = tools.getTool("portfolio_vendable_options_set");
    expect(tool?.requiredPermission).toBe("portfolio:vendable:create:tenant");
    expect(tool?.ownerApp).toBe("@apps/portfolio");

    const out = (await tool?.handler({
      id: "v1",
      groups: [{ code: "color", values: [{ value: "Black" }] }],
    })) as { id: string };
    expect(out.id).toBe("v1");
    expect(seen.length).toBe(1);

    await expect(tool?.handler({ groups: [] })).rejects.toThrow(
      "Missing required 'id'",
    );
    await expect(tool?.handler({ id: "v1" })).rejects.toThrow(
      "Missing required 'groups' array",
    );
  });

  it("surfaces BAC validation errors without swallowing them", async () => {
    const tools = new MCPToolRegistry();
    registerPortfolioTools(tools, {
      ...optionsClient,
      setProductOptions: async () => {
        throw new Error("Options produit invalides : options[0] : code manquant");
      },
    });

    await expect(
      tools.getTool("portfolio_vendable_options_set")?.handler({
        id: "v1",
        groups: [{ values: [] }],
      }),
    ).rejects.toThrow("Options produit invalides");
  });
});
