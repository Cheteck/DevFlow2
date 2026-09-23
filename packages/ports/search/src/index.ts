export interface SearchQuery {
  term: string;
  limit?: number;
  offset?: number;
  filters?: Record<string, string | number | boolean>;
}

export interface SearchResult<T> {
  hits: T[];
  total: number;
}

/**
 * SearchPort — Decouples application indexing and full-text search from Elasticsearch, Meilisearch, etc.
 */
export interface SearchPort {
  /** Asynchronously indexes a document. */
  index<T>(indexName: string, id: string, document: T): Promise<void>;
  /** Asynchronously searches for documents. */
  search<T>(indexName: string, query: SearchQuery): Promise<SearchResult<T>>;
  /** Asynchronously deletes a document from the index. */
  delete(indexName: string, id: string): Promise<void>;
}
