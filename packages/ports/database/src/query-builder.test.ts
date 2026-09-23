import { describe, expect, it } from "vitest";
import {
  createQueryBuilder,
  SelectQueryBuilder,
  InsertQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from "./query-builder.js";
import type { DatabaseCapabilities, DatabasePort, MigrationLock } from "./index.js";

class MockDbAdapter implements DatabasePort {
  readonly capabilities: DatabaseCapabilities = {
    dialect: "sqlite",
    transactions: true,
    lock: { distributed: false, processSafe: true, runtimeSafe: true },
  };

  executedSql: string[] = [];
  executedParams: unknown[][] = [];

  async execute(sql: string, params?: readonly unknown[]): Promise<number> {
    this.executedSql.push(sql);
    this.executedParams.push((params || []) as unknown[]);
    return 1;
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<T[]> {
    this.executedSql.push(sql);
    this.executedParams.push((params || []) as unknown[]);
    return [{ id: 1, name: "Alice" }] as unknown as T[];
  }

  async transaction<T>(fn: (tx: DatabasePort) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async acquireMigrationLock(): Promise<MigrationLock> {
    return { release: async () => {} };
  }
}

describe("DML QueryBuilder", () => {
  it("compiles SELECT query with WHERE and ORDER BY for SQLite", () => {
    const qb = new SelectQueryBuilder()
      .select("id", "name", "email")
      .from("users")
      .where("role", "=", "admin")
      .andWhere("active", "=", true)
      .orderBy("created_at", "DESC")
      .limit(10)
      .offset(20);

    const { sql, params } = qb.toSql("sqlite");
    expect(sql).toBe(
      'SELECT "id", "name", "email" FROM "users" WHERE "role" = ? AND "active" = ? ORDER BY "created_at" DESC LIMIT 10 OFFSET 20'
    );
    expect(params).toEqual(["admin", true]);
  });

  it("compiles SELECT query with Postgres $1 placeholders", () => {
    const qb = new SelectQueryBuilder()
      .from("users")
      .where("age", ">=", 18)
      .andWhere("status", "IN", ["active", "pending"]);

    const { sql, params } = qb.toSql("postgres");
    expect(sql).toBe(
      'SELECT * FROM "users" WHERE "age" >= $1 AND "status" IN ($2, $3)'
    );
    expect(params).toEqual([18, "active", "pending"]);
  });

  it("compiles INSERT query", () => {
    const qb = new InsertQueryBuilder()
      .into("products")
      .values({ name: "Widget", price: 99 });

    const { sql, params } = qb.toSql("postgres");
    expect(sql).toBe(
      'INSERT INTO "products" ("name", "price") VALUES ($1, $2)'
    );
    expect(params).toEqual(["Widget", 99]);
  });

  it("compiles UPDATE query", () => {
    const qb = new UpdateQueryBuilder()
      .table("users")
      .set({ name: "Bob", updatedAt: "2026-09-22" })
      .where("id", "=", 42);

    const { sql, params } = qb.toSql("sqlite");
    expect(sql).toBe(
      'UPDATE "users" SET "name" = ?, "updatedAt" = ? WHERE "id" = ?'
    );
    expect(params).toEqual(["Bob", "2026-09-22", 42]);
  });

  it("compiles DELETE query", () => {
    const qb = new DeleteQueryBuilder()
      .from("sessions")
      .where("expired", "=", true);

    const { sql, params } = qb.toSql("postgres");
    expect(sql).toBe('DELETE FROM "sessions" WHERE "expired" = $1');
    expect(params).toEqual([true]);
  });

  it("executes via DatabasePort instance using factory createQueryBuilder", async () => {
    const mockDb = new MockDbAdapter();
    const qb = createQueryBuilder();

    const users = await qb
      .select<{ id: number; name: string }>("id", "name")
      .from("users")
      .where("id", "=", 1)
      .execute(mockDb);

    expect(users).toEqual([{ id: 1, name: "Alice" }]);
    expect(mockDb.executedSql[0]).toBe('SELECT "id", "name" FROM "users" WHERE "id" = ?');
    expect(mockDb.executedParams[0]).toEqual([1]);
  });
});
