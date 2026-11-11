# @mosaix/migrations

MosaiX Migration Engine — source-agnostic schema migrations for framework and
applications.

Inspired by the Laravel migration engine, but native to TypeScript: a
migration is a **module** (an `up(context)` body), never a SQL string.

Aligned with [ADR-0006](../../../.project/decisions/ADR-0006-database-port-migration-engine.md)
and PRD-0006 (`.project/prd/PRD-0006-migrations-engine.md`).

## Architecture (ADR-0006)

```text
 MigrationProvider          MigrationRegistry
 (manifest)        ─────▶  (validation, ordering)
                                  │
                                  ▼
                            MigrationPlanner ──▶ MigrationPlan
                            (delta + compilation)   (immutable, carries
                                  │                  the compiled SQL)
                                  ▼
                            MigrationRunner ──▶ DatabasePort
                            (lock, transaction)      │
                                  │                  ▼
                            MigrationStore        the database
                            (ledger)
```

- **Provider** aggregates the migrations of one owner (`ownerId`), the
  manifest of an application. The engine never scans the filesystem.
- **Registry** validates every migration (Validator), rejects full identity
  collisions (`owner.module.version.sequence_name`, R9) and orders the
  migrations globally (rank, then canonical id).
- **Planner** computes the deterministic delta between the desired state
  (Registry) and the current state (Store) and produces an immutable
  `MigrationPlan` (R12, R13, R14). It is also the **compilation boundary**:
  the plan carries the compiled SQL statements, so the previewed SQL is
  exactly the executed SQL.
- **Runner** executes only the validated plan, under the adapter-provided
  migration lock (R3). It never computes an upgrade itself.

## TypeScript native migrations (only accepted form)

```ts
import type { Migration, MigrationContext } from "@mosaix/migrations";

export const migration: Migration = {
  id: "solara.social.v1.001_create_social_tables",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["227693bae95b7667"],
  resources: ["table:solara_posts"],
  up: (context: MigrationContext) => {
    context.schema.createTable("solara_posts", (table) => {
      table.string("id").primary();
      table.string("actorId");
      table.index("idx_solara_posts_actor", ["actorId"]);
    });
  },
  downMigration: (context: MigrationContext) => {
    context.schema.dropTable("solara_posts");
  },
};
```

The SQL legacy mode (`content` / `down` strings, `kind` discriminant) and
the raw-SQL escape hatch (`rawSql` / `downRawSql`) have been **removed**.

The rule is enforced **in code**, at three levels — a migration declaring
one of those fields is rejected before anything is compiled or executed:

| Level                                                       | Entry point                            |
| ----------------------------------------------------------- | -------------------------------------- |
| `MigrationRegistry.register()`                              | `loadMigration()`                      |
| `MigrationValidator.validate()`                             | the validation of a declared migration |
| `MigrationCompiler.compileUpAsync()` / `compileDownAsync()` | the compilation of a plan              |

```ts
export const LEGACY_SQL_FIELDS = [
  "content",
  "down",
  "kind",
  "rawSql",
  "downRawSql",
] as const;

assertTypeScriptNativeMigration(candidate, migrationId); // throws MigrationError
```

### The schema DSL

`context.schema` builds an abstract blueprint; the engine compiles it with
the grammar of the adapter in use (SQLite / PostgreSQL):

| Blueprint                                      | Effect                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `createTable(name, fn)`                        | create a table (columns, indexes, unique, foreign keys)             |
| `dropTable(name)`                              | drop a table                                                        |
| `addColumn(table, name, type, fn?)`            | add a column                                                        |
| `dropColumn(table, name)`                      | drop a column                                                       |
| `renameColumn(table, from, to)`                | rename a column                                                     |
| `renameTable(table, to)`                       | rename a table                                                      |
| `createIndex(table, name, columns, options?)`  | create an index (sort directions, schema, `IF NOT EXISTS`, partial) |
| `dropIndex(name, schema?)`                     | drop an index                                                       |
| `addConstraint(table, name, definition)`       | add a table constraint (`UNIQUE (…)`, `CHECK (…)`)                  |
| `dropConstraint(table, name, { ifExists })`    | drop a table constraint                                             |
| `alterColumnType(table, column, type)`         | change the type of a column                                         |
| `alterColumnDefault(table, column, value?)`    | set (or drop) the default of a column                               |
| `alterColumnNullable(table, column, nullable)` | set (or drop) the `NOT NULL` constraint                             |
| `createSchema(name)`                           | create a schema                                                     |
| `moveTableToSchema(table, from, to)`           | move a table to another schema                                      |
| `renameTableInSchema(schema, table, to)`       | rename a table inside its schema                                    |

Column types: `string`, `text`, `integer`, `bigInteger`, `decimal`, `real`,
`uuid`, `timestamp` (`TIMESTAMP WITH TIME ZONE`), `timestampWithoutTimeZone`
(`TIMESTAMP`), `json`, `enum`, `boolean`.

A column is `NOT NULL` **by default** (the Laravel convention): a nullable
column must be marked explicitly:

```ts
table.text("display_name").nullable();
```

The schema-aware operations (`createSchema`, `moveTableToSchema`,
`renameTableInSchema`, `addConstraint`, `dropConstraint`,
`alterColumn*`, `dropIndex`) are **PostgreSQL only**: the SQLite grammar
rejects them explicitly (fail fast, never a silent no-op).

A default can be a structured expression (`now()`, `gen_random_uuid()`):

```ts
context.schema.alterColumnDefault(
  { schema: "solara", name: "posts" },
  "createdAt",
  func("now"),
);
```

### Data statements

A migration is not only a schema change: it may also move data (backfill,
seed, normalization). The structured API — the Laravel `DB::table()`
equivalent — declares them without any SQL string:

```ts
context.data.insert("audit_log", { id: "1", action: "login" });
context.data.insertSelect(
  { schema: "portfolio", name: "features" },
  ["id", "code"],
  select({
    columns: ["id", "code"],
    from: { schema: "portfolio", name: "feature_groups" },
  }),
);
context.data.update(
  { schema: "portfolio", name: "features" },
  { purpose: value("multivalue") },
  [inValues("code", ["misc.models"])],
);
context.data.delete({ schema: "portfolio", name: "vendable_tags" }, [
  inSubquery(
    "tagId",
    select({ columns: ["id"], from: { schema: "portfolio", name: "tags" } }),
  ),
]);
```

The values travel as **statement parameters** — never concatenated into the
SQL. The DDL and the DML are interleaved exactly as the migration declares
them: they share the same ordered list of statements.

### Expressions and queries

The data API is built on a closed set of structured expressions — never on
free-form SQL text:

| Helper                   | SQL                                                       |
| ------------------------ | --------------------------------------------------------- |
| `value(v)`               | a literal (bound as a parameter)                          |
| `column(name)`           | `"column"` (a dotted name is qualified: `column("v.id")`) |
| `jsonPath(column, key)`  | `("column"->>'key')`                                      |
| `cast(expr, type)`       | `(expr::type)`                                            |
| `nullIf(expr, fallback)` | `NULLIF(expr, fallback)`                                  |
| `matches(expr, pattern)` | `expr ~ pattern`                                          |
| `inList(target, values)` | `target IN (…)`                                           |
| `subquery(query)`        | `(SELECT …)` — a scalar subquery                          |
| `func(name, ...args)`    | `name(args)` — a function call (`func("now")`)            |
| `count()`                | `COUNT(*)`                                                |

Conditions: `equals`, `isNull`, `isNotNull`, `compare`, `matchesPattern`,
`inValues`, `inSubquery`, `notExists`.

There is a single query model: `select(config)` builds it, `subquery(query)`
projects it. `subquery` is only a scalar wrapper — not a second constructor.

### The one documented exception: procedural code

`createFunction` / `createTrigger` declare a **PL/pgSQL body** — the code of
the function, never a DDL/DML command. The engine owns the command
(`CREATE OR REPLACE FUNCTION`); the migration owns the body:

```ts
context.schema.createFunction(
  "set_updated_at",
  `BEGIN NEW."updatedAt" = now(); RETURN NEW; END;` as TrustedFunctionBody,
  { returns: "TRIGGER", language: "plpgsql", replace: true },
);
```

This is the only place where a migration carries SQL-ish text, and it is
PostgreSQL only (the SQLite grammar rejects it explicitly). It is **not** a
raw-SQL escape hatch: a body cannot be a DDL/DML command.

## The audit guards

Converting the historical SQL migrations to the TypeScript native form is
one-shot work; keeping the schema faithful is continuous. Four audits
compare the migrations with their historical reference (the previous
revision of the repository) and fail on any divergence:

```bash
pnpm audit:migrations
```

| Audit                   | What it guarantees                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `audit-nullability`     | a column the historical SQL leaves nullable is still nullable (the DSL is `NOT NULL` by default) |
| `audit-types`           | the declared column types are unchanged (`VARCHAR(255)` did not become `TEXT`)                   |
| `audit-tables`          | the table references are table names, never SQL fragments                                        |
| `audit-sql-equivalence` | the generated SQL is semantically the same as the historical one                                 |

They are the production guard against the schema drifting away from what is
deployed. Run them in CI next to `pnpm check:migration-checksums`.

## Migration identity

```
owner.module.version.sequence_name
identity.users.v1.001_create_users
```

The sequence is compared **numerically** (R6). Global ordering: framework
bootstrap → modules framework → DAG applicatif → migrations applicatives
(R10), expressed with a per-provider `rank`.

## Checksum and immutability

A migration must declare an explicit checksum: the digest of its **source
code**, computed by the build tooling:

```bash
pnpm migration:checksums          # recompute every checksum
pnpm check:migration-checksums    # CI: fail on drift
```

The digest is a SHA-256 of the normalized source (the checksum block itself
is excluded). A migration whose source changed after being applied is
rejected (`MigrationChecksumError`) — the ledger is the source of truth.

`legacyChecksums` lists the checksums previously recorded in the ledger for
the same migration id: it is the explicit compatibility mapping used when a
migration is reworked (for instance when it was converted from a SQL string
to a TypeScript native module). The declared `checksum` always remains the
effective one.

## Rollback

`downMigration(context)` declares the inverse operation. A migration that
declares none is **irreversible**: the rollback is refused before any mutation
(`MigrationExecutionError`).

## Public API

```typescript
MigrationRegistry; // register(provider, rank?), all(), get(), ownerOf()
MigrationPlanner; // plan({ rollback? }) → MigrationPlan (compiled statements)
MigrationRunner; // run(plan) → { applied, rolledBack }
MigrationCompiler; // compileUpAsync(migration), compileDownAsync(migration)
MigrationValidator; // validate(migration) → ValidationResult
InMemoryMigrationStore; // MigrationStore (prototype/tests)
SqlMigrationStore; // persistent ledger (mosaix_migrations)
ManifestMigrationProvider; // provider over an explicit manifest
loadMigration(raw); // loads + validates a raw declaration
compareMigrationIds(a, b); // numeric ordering (R6)
computeChecksum(content); // FNV-1a 64 (spike)
computeSourceChecksum(sources); // SHA-256 of the migration source

// Database port (re-exported)
(DatabasePort, DatabaseCapabilities, Dialect, LockCapabilities, MigrationLock);
```

## CLI

| Command                               | Effect                                         |
| ------------------------------------- | ---------------------------------------------- |
| `mosaix migrate`                      | plan the delta and apply it                    |
| `mosaix migrate:status`               | desired vs applied state                       |
| `mosaix migrate:rollback [--steps=N]` | undo the last batch (or N steps)               |
| `mosaix migrate:fresh`                | drop the schema, re-run everything             |
| `mosaix migrate:mark <id>`            | mark a migration as applied without running it |
