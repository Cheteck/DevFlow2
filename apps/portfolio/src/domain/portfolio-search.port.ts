import type { Vendable } from "./vendable.js";

export interface SearchFacets {
  categories: Record<string, number>;
  tags: Record<string, number>;
  priceRanges: {
    under25: number;
    from25to100: number;
    above100: number;
  };
}

export interface SearchQueryParams {
  query?: string;
  category?: string;
  tag?: string;
  minPrice?: number;
  maxPrice?: number;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  hits: Vendable[];
  totalHits: number;
  facets: SearchFacets;
  processingTimeMs: number;
}

export interface PortfolioSearchPort {
  index(vendables: Vendable[]): Promise<void>;
  search(params: SearchQueryParams): Promise<SearchResult>;
  delete(id: string): Promise<void>;
}

/**
 * In-Memory Search Engine Adapter with dynamic faceting
 */
export class InMemoryPortfolioSearchAdapter implements PortfolioSearchPort {
  private items = new Map<string, Vendable>();

  async index(vendables: Vendable[]): Promise<void> {
    for (const v of vendables) {
      this.items.set(v.identity.id, v);
    }
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }

  async search(params: SearchQueryParams): Promise<SearchResult> {
    const start = Date.now();
    let results = Array.from(this.items.values());

    // Filter by text query (name/description)
    if (params.query && params.query.trim()) {
      const q = params.query.toLowerCase();
      results = results.filter((v) => {
        const fr = v.content["fr"] || v.content["en"] || Object.values(v.content)[0];
        const nameMatch = fr?.name.toLowerCase().includes(q) ?? false;
        const descMatch = fr?.description?.toLowerCase().includes(q) ?? false;
        return nameMatch || descMatch;
      });
    }

    // Filter by category
    if (params.category) {
      results = results.filter((v) => v.classification.categories?.includes(params.category!));
    }

    // Filter by tag
    if (params.tag) {
      results = results.filter((v) => v.classification.tags?.includes(params.tag!));
    }

    // Filter by status
    if (params.status) {
      results = results.filter((v) => v.identity.status === params.status);
    }

    // Filter by price
    if (params.minPrice !== undefined) {
      results = results.filter((v) => (v.pricing?.basePrice ?? 0) >= params.minPrice!);
    }
    if (params.maxPrice !== undefined) {
      results = results.filter((v) => (v.pricing?.basePrice ?? 0) <= params.maxPrice!);
    }

    // Compute facets on all matching results before pagination
    const facets: SearchFacets = {
      categories: {},
      tags: {},
      priceRanges: { under25: 0, from25to100: 0, above100: 0 },
    };

    for (const item of results) {
      item.classification.categories?.forEach((c) => {
        facets.categories[c] = (facets.categories[c] || 0) + 1;
      });
      item.classification.tags?.forEach((t) => {
        facets.tags[t] = (facets.tags[t] || 0) + 1;
      });
      const price = item.pricing?.basePrice ?? 0;
      if (price < 25) facets.priceRanges.under25 += 1;
      else if (price <= 100) facets.priceRanges.from25to100 += 1;
      else facets.priceRanges.above100 += 1;
    }

    const totalHits = results.length;
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 20;
    const paginatedHits = results.slice(offset, offset + limit);

    return {
      hits: paginatedHits,
      totalHits,
      facets,
      processingTimeMs: Date.now() - start,
    };
  }
}
