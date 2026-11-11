/**
 * @mosaix/migrations — SchemaBuilder DSL coverage (Laravel Blueprint parity).
 *
 * The DSL is the primary API of a migration: these tests lock the SQL
 * produced for each blueprint, on both grammars.
 */
import { describe, expect, it } from "vitest";
import {
  PostgresGrammar,
  SchemaBuilder,
  SQLiteGrammar,
  func,
} from "./index.js";

function sql(
  builder: SchemaBuilder,
  grammar = new PostgresGrammar(),
): string[] {
  return builder.compile(grammar).map((statement) => statement.sql);
}

describe("DSL — schemas (PostgreSQL only)", () => {
  it("creates a schema", () => {
    const builder = new SchemaBuilder();
    builder.createSchema("solara");

    expect(sql(builder)).toEqual(['CREATE SCHEMA IF NOT EXISTS "solara";']);
  });

  it("moves a table to another schema", () => {
    const builder = new SchemaBuilder();
    builder.moveTableToSchema("solara_posts", "public", "solara");

    expect(sql(builder)).toEqual([
      'ALTER TABLE IF EXISTS "public"."solara_posts" SET SCHEMA "solara";',
    ]);
  });

  it("renames a table inside its schema", () => {
    const builder = new SchemaBuilder();
    builder.renameTableInSchema("solara", "solara_posts", "posts");

    expect(sql(builder)).toEqual([
      'ALTER TABLE IF EXISTS "solara"."solara_posts" RENAME TO "posts";',
    ]);
  });

  it("fails fast on SQLite (no schema support)", () => {
    const builder = new SchemaBuilder();
    builder.createSchema("solara");

    expect(() => builder.compile(new SQLiteGrammar())).toThrow(
      /Unsupported blueprint type on sqlite/,
    );
  });
});

describe("DSL — constraints", () => {
  it("adds a table constraint", () => {
    const builder = new SchemaBuilder();
    builder.addConstraint(
      { schema: "solara", name: "reactions" },
      "reactions_one_per_actor_target",
      'UNIQUE ("targetType", "targetId")',
    );

    expect(sql(builder)).toEqual([
      'ALTER TABLE "solara"."reactions" ADD CONSTRAINT "reactions_one_per_actor_target" UNIQUE ("targetType", "targetId");',
    ]);
  });

  it("drops a table constraint", () => {
    const builder = new SchemaBuilder();
    builder.dropConstraint({ schema: "solara", name: "reactions" }, "gone");

    expect(sql(builder)).toEqual([
      'ALTER TABLE "solara"."reactions" DROP CONSTRAINT IF EXISTS "gone";',
    ]);
  });

  it("works on an unqualified table", () => {
    const builder = new SchemaBuilder();
    builder.addConstraint(
      { name: "users" },
      "users_email_unique",
      'UNIQUE ("email")',
    );

    expect(sql(builder)).toEqual([
      'ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE ("email");',
    ]);
  });
});

describe("DSL — column alterations (PostgreSQL only)", () => {
  it("changes the type of a column", () => {
    const builder = new SchemaBuilder();
    builder.alterColumnType(
      { schema: "solara", name: "posts" },
      "content",
      "text",
    );

    expect(sql(builder)).toEqual([
      'ALTER TABLE "solara"."posts" ALTER COLUMN "content" TYPE TEXT;',
    ]);
  });

  it("sets a default", () => {
    const builder = new SchemaBuilder();
    builder.alterColumnDefault(
      { schema: "solara", name: "posts" },
      "createdAt",
      func("now"),
    );

    expect(sql(builder)).toEqual([
      'ALTER TABLE "solara"."posts" ALTER COLUMN "createdAt" SET DEFAULT now();',
    ]);
  });

  it("drops a default", () => {
    const builder = new SchemaBuilder();
    builder.alterColumnDefault(
      { schema: "solara", name: "posts" },
      "createdAt",
    );

    expect(sql(builder)).toEqual([
      'ALTER TABLE "solara"."posts" ALTER COLUMN "createdAt" DROP DEFAULT;',
    ]);
  });

  it("changes the nullability", () => {
    const builder = new SchemaBuilder();
    builder.alterColumnNullable(
      { schema: "solara", name: "posts" },
      "x",
      false,
    );

    expect(sql(builder)).toEqual([
      'ALTER TABLE "solara"."posts" ALTER COLUMN "x" SET NOT NULL;',
    ]);
  });
});

describe("DSL — indexes", () => {
  it("creates a schema-qualified index with sort directions", () => {
    const builder = new SchemaBuilder();
    builder.createIndex(
      { schema: "solara", name: "posts" },
      "idx_posts_created_id",
      [
        { name: "createdAt", direction: "desc" },
        { name: "id", direction: "desc" },
      ],
      { ifNotExists: true },
    );

    expect(sql(builder)).toEqual([
      'CREATE INDEX IF NOT EXISTS "idx_posts_created_id" ON "solara"."posts" ("createdAt" DESC, "id" DESC);',
    ]);
  });

  it("creates a unique index", () => {
    const builder = new SchemaBuilder();
    builder.createIndex(
      { schema: "solara", name: "followers" },
      "uniq_followers",
      [{ name: "a" }, { name: "b" }],
      { unique: true, ifNotExists: true },
    );

    expect(sql(builder)).toEqual([
      'CREATE UNIQUE INDEX IF NOT EXISTS "uniq_followers" ON "solara"."followers" ("a", "b");',
    ]);
  });

  it("creates an index from plain column names", () => {
    const builder = new SchemaBuilder();
    builder.createIndex("solara", "idx_posts_title", ["title"], {
      ifNotExists: true,
    });

    expect(sql(builder)).toEqual([
      'CREATE INDEX IF NOT EXISTS "idx_posts_title" ON "solara" ("title");',
    ]);
  });

  it("drops an index", () => {
    const builder = new SchemaBuilder();
    builder.dropIndex("idx_posts_created_id", "solara");

    expect(sql(builder)).toEqual([
      'DROP INDEX IF EXISTS "solara"."idx_posts_created_id";',
    ]);
  });
});

describe("DSL — column types", () => {
  it("maps text and bigInteger on PostgreSQL", () => {
    const builder = new SchemaBuilder();
    builder.createTable("t", (table) => {
      table.text("body");
      table.bigInteger("counter");
    });

    const statements = sql(builder).join("\n");
    expect(statements).toContain('"body" TEXT');
    expect(statements).toContain('"counter" BIGINT');
  });

  it("maps text and bigInteger on SQLite", () => {
    const builder = new SchemaBuilder();
    builder.createTable("t", (table) => {
      table.text("body");
      table.bigInteger("counter");
    });

    const statements = sql(builder, new SQLiteGrammar()).join("\n");
    expect(statements).toContain('"body" TEXT');
    expect(statements).toContain('"counter" INTEGER');
  });
});
