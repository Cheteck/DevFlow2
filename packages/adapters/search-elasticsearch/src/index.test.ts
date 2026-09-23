/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { Client } from "@elastic/elasticsearch";
import { ElasticsearchSearchAdapter } from "./index";

describe("ElasticsearchSearchAdapter", () => {
  it("interacts with Elasticsearch Client methods correctly", async () => {
    let indexedId: string = "";
    let indexedDoc: any = null;
    let searchedIndex: string = "";

    const mockClient: any = {
      index: async (params: any) => {
        indexedId = params.id;
        indexedDoc = params.document;
      },
      search: async (params: any) => {
        searchedIndex = params.index;
        return {
          hits: {
            total: 1,
            hits: [{ _source: { name: "Alice" } }],
          },
        };
      },
      delete: async () => {},
    };

    const adapter = new ElasticsearchSearchAdapter(
      mockClient as unknown as Client,
    );

    await adapter.index("users", "1", { name: "Alice" });
    expect(indexedId).toBe("1");
    expect(indexedDoc).toEqual({ name: "Alice" });

    const searchRes = await adapter.search("users", { term: "Alice" });
    expect(searchedIndex).toBe("users");
    expect(searchRes.total).toBe(1);
    expect(searchRes.hits).toEqual([{ name: "Alice" }]);
  });
});
