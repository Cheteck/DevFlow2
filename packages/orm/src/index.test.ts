import { describe, expect, it, vi } from "vitest";
import { QueryBuilder } from "./query-builder";
import { Model, Repository } from "./repository";
import type { DatabasePort } from "@mosaix/ports-database";

describe("QueryBuilder", () => {
  it("compiles SELECT queries with PostgreSQL placeholders", () => {
    const qb = QueryBuilder.table("users", "postgres")
      .select("id", "name", "email")
      .where("status", "active")
      .where("age", ">=", 18)
      .orderBy("created_at", "DESC")
      .limit(10)
      .offset(20);

    const { sql, params } = qb.toSQL();

    expect(sql).toBe(
      'SELECT "id", "name", "email" FROM "users" WHERE "status" = $1 AND "age" >= $2 ORDER BY "created_at" DESC LIMIT 10 OFFSET 20'
    );
    expect(params).toEqual(["active", 18]);
  });

  it("compiles SELECT queries with SQLite placeholders", () => {
    const qb = QueryBuilder.table("users", "sqlite")
      .select("id", "name")
      .where("role", "admin")
      .orderBy("name", "ASC");

    const { sql, params } = qb.toSQL();

    expect(sql).toBe('SELECT `id`, `name` FROM `users` WHERE `role` = ? ORDER BY `name` ASC');
    expect(params).toEqual(["admin"]);
  });

  it("supports joins and whereIn", () => {
    const qb = QueryBuilder.table("orders", "postgres")
      .join("users", "orders.user_id", "=", "users.id")
      .whereIn("status", ["pending", "processing"]);

    const { sql, params } = qb.toSQL();

    expect(sql).toBe(
      'SELECT * FROM "orders" INNER JOIN "users" ON "orders"."user_id" = "users"."id" WHERE "status" IN ($1, $2)'
    );
    expect(params).toEqual(["pending", "processing"]);
  });

  it("compiles INSERT statements with RETURNING * for PostgreSQL", () => {
    const qb = QueryBuilder.table("users", "postgres").insert({ name: "Alice", email: "alice@example.com" });

    const { sql, params } = qb.toSQL();

    expect(sql).toBe('INSERT INTO "users" ("name", "email") VALUES ($1, $2) RETURNING *');
    expect(params).toEqual(["Alice", "alice@example.com"]);
  });

  it("compiles UPDATE statements", () => {
    const qb = QueryBuilder.table("users", "postgres")
      .where("id", "user-123")
      .update({ name: "Bob" });

    const { sql, params } = qb.toSQL();

    expect(sql).toBe('UPDATE "users" SET "name" = $1 WHERE "id" = $2');
    expect(params).toEqual(["Bob", "user-123"]);
  });

  it("compiles DELETE statements", () => {
    const qb = QueryBuilder.table("users", "sqlite")
      .where("id", "user-456")
      .delete();

    const { sql, params } = qb.toSQL();

    expect(sql).toBe('DELETE FROM `users` WHERE `id` = ?');
    expect(params).toEqual(["user-456"]);
  });
});

describe("Model & Repository", () => {
  class User extends Model {
    static override tableName = "users";
    name!: string;
    email!: string;
  }

  const mockDb: DatabasePort = {
    query: vi.fn(async () => []),
    // Contrat DatabasePort.execute: Promise<number> (affected row count),
    // comme les adapters sqlite/postgres — pas un objet { affectedRows }.
    execute: vi.fn(async () => 1),
    transaction: vi.fn(),
    close: vi.fn(),
    isConnected: vi.fn(() => true),
  };

  it("creates a repository and performs CRUD operations", async () => {
    const repo = new Repository(mockDb, User, "users", "id", "postgres");

    // Create
    vi.mocked(mockDb.query).mockResolvedValueOnce([{ id: "1", name: "Alice", email: "alice@mosaix.dev" }]);
    const created = await repo.create({ name: "Alice", email: "alice@mosaix.dev" });
    expect(created).toBeInstanceOf(User);
    expect(created.name).toBe("Alice");

    // FindById
    vi.mocked(mockDb.query).mockResolvedValueOnce([{ id: "1", name: "Alice", email: "alice@mosaix.dev" }]);
    const found = await repo.findById("1");
    expect(found?.email).toBe("alice@mosaix.dev");

    // Update
    const updated = await repo.update("1", { name: "Alice Updated" });
    expect(updated).toBe(true);

    // Delete
    const deleted = await repo.delete("1");
    expect(deleted).toBe(true);
  });
});
