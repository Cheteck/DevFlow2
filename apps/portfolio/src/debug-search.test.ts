import { describe, expect, it, beforeEach } from "vitest";
import { PortfolioService } from "./domain/portfolio-service.js";
import { InMemoryVendableRepository } from "./infrastructure/in-memory-vendable-repository.js";

const TENANT_ORAN = "tenant-oran";

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

describe("DEBUG search direct", () => {
  let repo: InMemoryVendableRepository;
  let service: PortfolioService;

  beforeEach(async () => {
    repo = new InMemoryVendableRepository();
    service = new PortfolioService(repo);
    await service.createVendable(makeVendable("vnd-oran-001", "REF-ORA-001", "Produit Oran 1"), TENANT_ORAN);
    await service.createVendable(makeVendable("vnd-oran-002", "REF-ORA-002", "Produit Oran 2"), TENANT_ORAN);
  });

  it("findAll direct", async () => {
    const all = await repo.findAll(TENANT_ORAN);
    console.log("findAll:", all.length, all.map((v) => v.content?.fr?.name));
  });

  it("search direct name=Produit", async () => {
    const res = await service.search({ offset: 0, limit: 50, name: "Produit" }, TENANT_ORAN);
    console.log("search direct:", res.length, res.map((v) => v.identity.id));
  });

  it("search direct no criteria", async () => {
    const res = await service.search({ offset: 0, limit: 50 }, TENANT_ORAN);
    console.log("search no criteria:", res.length);
  });
});
