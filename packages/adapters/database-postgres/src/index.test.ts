import { describe, expect, it } from "vitest";
import { PostgresDatabaseAdapter } from "./index";
import type { PgClient, PgQueryResult } from "./index";

class MockPgClient implements PgClient {
  readonly queries: string[] = [];
  readonly params: (readonly unknown[])[] = [];

  constructor(
    private readonly responseRows: readonly unknown[] = [],
    private readonly rowCountValue = 0,
  ) {}

  async query(
    sql: string,
    params?: readonly unknown[],
  ): Promise<PgQueryResult> {
    this.queries.push(sql);
    if (params) {
      this.params.push(params);
    }
    return {
      rows: this.responseRows,
      rowCount: this.rowCountValue,
    };
  }
}

describe("PostgresDatabaseAdapter", () => {
  it("executes statements and returns affected rowCount", async () => {
    const client = new MockPgClient([], 5);
    const db = new PostgresDatabaseAdapter(client);
    const count = await db.execute("UPDATE users SET name = $1", ["John"]);

    expect(count).toBe(5);
    expect(client.queries).toEqual(["UPDATE users SET name = $1"]);
    expect(client.params).toEqual([["John"]]);
  });

  it("queries rows and returns typed arrays", async () => {
    const rows = [{ id: 1, email: "test@example.com" }];
    const client = new MockPgClient(rows);
    const db = new PostgresDatabaseAdapter(client);

    const result = await db.query("SELECT * FROM users");
    expect(result).toEqual(rows);
    expect(client.queries).toEqual(["SELECT * FROM users"]);
  });

  it("acquires and releases advisory locks", async () => {
    const client = new MockPgClient();
    const db = new PostgresDatabaseAdapter(client);

    const lock = await db.acquireMigrationLock();
    expect(client.queries).toEqual(["SELECT pg_advisory_lock(1104)"]);

    await lock.release();
    expect(client.queries).toEqual([
      "SELECT pg_advisory_lock(1104)",
      "SELECT pg_advisory_unlock(1104)",
    ]);
  });

  it("supports transactions", async () => {
    const client = new MockPgClient();
    const db = new PostgresDatabaseAdapter(client);

    const result = await db.transaction(async (tx) => {
      await tx.execute("INSERT INTO users VALUES (1)");
      return "done";
    });

    expect(result).toBe("done");
    expect(client.queries).toEqual([
      "BEGIN",
      "INSERT INTO users VALUES (1)",
      "COMMIT",
    ]);
  });

  it("rolls back transactions on throw", async () => {
    const client = new MockPgClient();
    const db = new PostgresDatabaseAdapter(client);

    await expect(
      db.transaction(async (tx) => {
        await tx.execute("INSERT INTO users VALUES (1)");
        throw new Error("failed");
      }),
    ).rejects.toThrow("failed");

    expect(client.queries).toEqual([
      "BEGIN",
      "INSERT INTO users VALUES (1)",
      "ROLLBACK",
    ]);
  });

  it("supports nested savepoints inside transaction", async () => {
    const client = new MockPgClient();
    const db = new PostgresDatabaseAdapter(client);

    await db.transaction(async (tx) => {
      await tx.execute("INSERT INTO users VALUES (1)");
      await db.transaction(async (tx2) => {
        await tx2.execute("INSERT INTO users VALUES (2)");
      });
    });

    expect(client.queries).toEqual([
      "BEGIN",
      "INSERT INTO users VALUES (1)",
      "SAVEPOINT mosaix_tx_1",
      "INSERT INTO users VALUES (2)",
      "RELEASE mosaix_tx_1",
      "COMMIT",
    ]);
  });
});
