import { describe, expect, it } from "vitest";
import { MemorySearchAdapter } from "./index";

describe("MemorySearchAdapter", () => {
  it("can index, search with filters and pagination, and delete", async () => {
    const search = new MemorySearchAdapter();

    await search.index("users", "1", { name: "Alice", active: true });
    await search.index("users", "2", { name: "Bob", active: false });
    await search.index("users", "3", { name: "Charlie", active: true });

    const search1 = await search.search<{ name: string }>("users", {
      term: "li",
    });
    expect(search1.total).toBe(2); // Alice and Charlie
    expect(search1.hits).toHaveLength(2);

    const search2 = await search.search<{ name: string }>("users", {
      term: "li",
      filters: { active: false },
    });
    expect(search2.total).toBe(0); // Bob has "li" but active: false

    await search.delete("users", "1");
    const search3 = await search.search<{ name: string }>("users", {
      term: "li",
    });
    expect(search3.total).toBe(1); // Only Charlie remains
  });
});
