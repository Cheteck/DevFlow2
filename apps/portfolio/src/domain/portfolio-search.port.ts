import type { Vendable } from "./vendable.js";

export interface SearchFacets {
  categories: Record<string, number>;
  tags: Record<string, number>;
  statuses: Record<string, number>;
}

export interface SearchQueryParams {
  query?: string;
  category?: string;
  tag?: string;
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
