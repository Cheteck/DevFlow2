/**
 * bootstrap/providers — Explicit provider registry (Laravel `bootstrap/providers.php`).
 *
 * Single place that lists, in boot order, the shell services composing the
 * application. Each entry points at the module owning the service — the
 * registry documents the composition graph without importing it (lazy
 * singletons stay lazy; see `bootstrap/app.ts` which only touches what the
 * boot path strictly needs: env, security, database, migrations check,
 * composition overrides, persisted theme).
 */

export interface ProviderDescriptor {
  /** Stable name, used in boot logs and diagnostics. */
  readonly name: string;
  /** Owning module (import path, `.js`-suffixed ESM style). */
  readonly module: string;
  /** What the provider contributes to the running application. */
  readonly describes: string;
}

export const applicationProviders: readonly ProviderDescriptor[] = [
  {
    name: "env",
    module: "@mosaix/core",
    describes: "loadEnvFile() + validateEnv() — canonical env, fail-fast.",
  },
  {
    name: "security",
    module: "../src/shell/security-guard.js",
    describes: "SecurityGuard production constraints (VULN-08).",
  },
  {
    name: "database",
    module: "../src/shell/database-bootstrap.js",
    describes:
      "Driver resolution (DB_CONNECTION / DATABASE_URL) + DatabaseManager + SQLite PRAGMAs.",
  },
  {
    name: "migrations-check",
    module: "../src/shell/migrations.js",
    describes:
      "Boot verifier only (getPendingMigrationIds) — never migrates at boot.",
  },
  {
    name: "composition",
    module: "../src/shell/composition-loader.js",
    describes: "CompositionManager + saved editor overrides.",
  },
  {
    name: "theme",
    module: "../src/shell/theme/theme-persistence.js",
    describes: "Persisted platform theme applied before serving traffic.",
  },
  {
    name: "feed",
    module: "../src/shell/feed-service.js",
    describes: "Per-request feed service singleton (lazy).",
  },
  {
    name: "events",
    module: "../src/shell/event-backplane.js",
    describes: "Distributed event backplane singleton (lazy).",
  },
  {
    name: "anonymization",
    module: "../src/shell/anonymization-orchestrator.js",
    describes: "Anonymization orchestrator singleton (lazy).",
  },
  {
    name: "bac-orchestrator",
    module: "../src/shell/orchestrator/bac-orchestrator.js",
    describes: "BAC descriptors + default BAC resolution (lazy).",
  },
  {
    name: "rate-limiter",
    module: "../src/shell/rate-limiter.js",
    describes: "Standard + strict API rate limiters.",
  },
];
