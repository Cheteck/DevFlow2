import { Client } from "@elastic/elasticsearch";
import type {
  SearchPort,
  SearchQuery,
  SearchResult,
} from "@mosaix/ports-search";

export class ElasticsearchSearchAdapter implements SearchPort {
  private readonly client: Client;

  constructor(clientOrConfig?: Client | Record<string, unknown>) {
    if (
      clientOrConfig &&
      (clientOrConfig instanceof Client ||
        (typeof clientOrConfig === "object" && "search" in clientOrConfig))
    ) {
      this.client = clientOrConfig as Client;
    } else {
      const config = (clientOrConfig as Record<string, unknown>) ?? {};
      this.client = new Client({
        node: (config["node"] as string) ?? "http://localhost:9200",
      });
    }
  }

  async index<T>(indexName: string, id: string, document: T): Promise<void> {
    await this.client.index({
      index: indexName,
      id,
      document,
    });
  }

  async search<T>(
    indexName: string,
    query: SearchQuery,
  ): Promise<SearchResult<T>> {
    const filtersList: Record<string, unknown>[] = [];
    if (query.filters) {
      for (const [key, val] of Object.entries(query.filters)) {
        filtersList.push({ term: { [key]: val } });
      }
    }

    const esQuery: Record<string, unknown> = {
      bool: {
        must: [
          {
            multi_match: {
              query: query.term,
              fields: ["*"],
            },
          },
        ],
      },
    };

    if (
      filtersList.length > 0 &&
      esQuery["bool"] &&
      typeof esQuery["bool"] === "object"
    ) {
      (esQuery["bool"] as Record<string, unknown>).filter = filtersList;
    }

    const response = await this.client.search({
      index: indexName,
      query: esQuery,
      from: query.offset,
      size: query.limit,
    });

    const total =
      typeof response.hits.total === "number"
        ? response.hits.total
        : ((response.hits.total as { value?: number })?.value ?? 0);

    const hits = response.hits.hits.map(
      (hit: { _source?: unknown }) => hit._source as T,
    );

    return { hits, total };
  }

  async delete(indexName: string, id: string): Promise<void> {
    await this.client.delete({
      index: indexName,
      id,
    });
  }
}
