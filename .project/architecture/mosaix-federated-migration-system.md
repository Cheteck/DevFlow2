# MosaiX Multi-App Migration Architecture (Simplified Laravel-like Model)

## Executive Summary

MosaiX adopts a **Laravel-like mental model for multi-app schema orchestration**. Each Bounded Application Context (App) or Package remains the explicit owner of its database schema and migrations. MosaiX provides light, predictable orchestration for discovery, ordering, execution, rollbacks, and state tracking, without introducing complex distributed graph workflows.

---

## 1. Core Principles

- **Simple Migrations**: A migration is a simple module exposing `up({ schema })` and `down({ schema })`.
- **Timestamp Ordering**: Natural chronological ordering determined by filename prefix (`202608160001_create_users.ts`).
- **Multi-Source Discovery**: Discovers migrations from Core, installed Packages, and App directories.
- **Local Schema Targets**: Each App manages its own migration state table in its schema (`app_schema.migrations`), avoiding monolithic central state.
- **Batch Executions**: Migrations execute in batches for clean, deterministic rollbacks (`mosai migrate:rollback`).
- **SQL Preview (`--pretend`)**: Compiles SQL statements without mutating database state.

---

## 2. Architecture & Public Primitives

The system exposes 5 public abstractions:

```
                 MosaiX Platform
                       │
          ┌────────────┼────────────┐
          │            │            │
       Identity     Portfolio     Billing
          │            │            │
       schema        schema       schema
          │            │            │
      migrations    migrations   migrations
          │            │            │
          └────────────┼────────────┘
                       │
                MigrationManager
                       │
              DatabaseManager
```

| Component | Responsibility |
|-----------|----------------|
| **MigrationSource** | Discovers migration files from Core, Packages, or Apps (`Core`, `Package`, `App`). |
| **MigrationManager** | Discovers, orders by timestamp, plans, and executes migrations per target. |
| **MigrationRepository** | Persists execution state in the local target's `migrations` table (`id`, `migration`, `batch`, `checksum`, `executed_at`). |
| **SchemaBuilder** | Fluent DSL for schema creation and modification (`createTable`, `addColumn`, `dropTable`). |
| **DatabaseManager** | Manages database targets, connections, transactions, and migration locks. |

---

## 3. Migration Example & Structure

```ts
export default {
  async up({ schema }) {
    await schema.createTable('users', table => {
      table.string('id').primary();
      table.string('email').unique();
      table.string('password');
      table.timestamps();
    });
  },

  async down({ schema }) {
    await schema.dropTable('users');
  }
};
```

**Filename**: `202608160001_create_users.ts`

---

## 4. App & Package Declaration

### App Declaration
```ts
export default defineApp({
  name: 'portfolio',
  database: {
    connection: 'portfolio',
    schema: 'portfolio'
  },
  migrations: './migrations'
});
```

### Package Declaration
```ts
export default definePackage({
  name: '@mosaix/auth',
  migrations: './migrations'
});
```

---

## 5. Local State Table (`migrations`)

Each target database/schema manages its own simple migration repository:

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer / primary | Auto-increment ID |
| `migration` | string | Filename / migration key |
| `batch` | integer | Batch number |
| `checksum` | string | Content SHA-256 for immutability verification |
| `executed_at` | timestamp | Execution timestamp |

---

## 6. CLI API

```bash
# Run all pending migrations
mosai migrate

# Run app-scoped migrations
mosai migrate --app=portfolio
mosai migrate --app=identity

# Preview SQL without executing
mosai migrate --pretend
mosai migrate --app=portfolio --pretend

# Rollback last batch
mosai migrate:rollback
mosai migrate:rollback --app=portfolio

# Inspection
mosai migrate:status
```
