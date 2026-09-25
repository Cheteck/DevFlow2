export interface SearchQuery {
  term: string;
  filters?: Record<string, unknown>;
  offset?: number;
  limit?: number;
}

export interface SearchResult<T> {
  hits: T[];
  total: number;
}

export interface SearchPort {
  index<T>(indexName: string, id: string, document: T): Promise<void>;
  search<T>(indexName: string, query: SearchQuery): Promise<SearchResult<T>>;
  delete(indexName: string, id: string): Promise<void>;
}
