/**
 * bootstrap/app — Application composition root (Laravel `bootstrap/app.php`).
 *
 * Doctrine (mirrors Laravel + artisan):
 * - This is the ONLY place that assembles the running application, in an
 *   explicit order: env → security → database → migrations check →
 *   composition → theme. HTTP (`src/start.ts`) and artisan-style CLI
 *   (`mosaix <command>`) share it instead of duplicating boot steps.
 * - The boot path only CONNECTS (driver from `DB_CONNECTION` / `DB_*` /
 *   `DATABASE_URL`, PRAGMAs awaited) and VERIFIES (pending-migrations
 *   fail-fast). Schema comes from versioned migrations (`mosaix migrate`),
 *   demo data from seeders (`mosaix db:seed`) — never from boot.
 * - Shell/docker/CI env always wins: dotenv files only fill missing keys
 *   (see `@mosaix/core` `loadEnvFile`).
 */

import {
  CompositionOverrideManager,
  loadEnvFile,
  validateEnv,
  type NormalizedEnv,
} from "@mosaix/core";
import type { DatabasePort } from "@mosaix/ports-database";
import type { IdentityStore } from "@mosaix/ports-identity-store";
import type { DatabaseConfig, DatabaseManager } from "@mosaix/database";
import { SecurityGuard } from "../src/shell/security-guard.js";
import {
  closeDatabase,
  initDatabase,
} from "../src/shell/database-bootstrap.js";
import { getPendingMigrationIds } from "../src/shell/migrations.js";
import { applyPersistedPlatformTheme } from "../src/shell/theme/theme-persistence.js";
import { loadSavedCompositionOverrides } from "../src/shell/editor.js";
import {
  applicationProviders,
  type ProviderDescriptor,
} from "./providers.js";

export { applicationProviders };
export type { ProviderDescriptor };

export interface ApplicationOptions {
  /** Defaults to `process.cwd()`. Relative SQLite paths resolve under it. */
  rootDir?: string;
  /** Defaults to `process.env`. Injected in tests. */
  env?: Record<string, string | undefined>;
  /** Dotenv files to fill from (missing files skipped). */
  envFiles?: string[];
  /** Skip `SecurityGuard.enforceProductionConstraints()` (tests). */
  skipSecurity?: boolean;
  /** Skip the pending-migrations fail-fast (CLI must run while unmigrated). */
  skipMigrationsCheck?: boolean;
  /** Skip applying the persisted platform theme (CLI / tests). */
  skipTheme?: boolean;
  /** Skip composition overrides loading (tests). */
  skipComposition?: boolean;
}

export interface Application {
  readonly rootDir: string;
  readonly env: NormalizedEnv;
  readonly manager: DatabaseManager;
  readonly dbAdapter: DatabasePort;
  readonly identityStore: IdentityStore;
  readonly config: DatabaseConfig;
  readonly compositionOverrideManager: CompositionOverrideManager;
  readonly providers: readonly ProviderDescriptor[];
  /**
   * Close connections and reset the shared bootstrap cache
   * (tests / shutdown). Idempotent — mirrors `MosaixApplication.close()`
   * without the stringly-typed service lookup.
   */
  readonly close: () => Promise<void>;
}

/**
 * Fluent builder — Laravel `Application::configure()->withX()` style.
 * Each `with*` step is idempotent-safe to call once; `build()` runs the
 * chain in the canonical order regardless of call order.
 */
export class ApplicationBuilder {
  private readonly options: Required<
    Pick<ApplicationOptions, "rootDir" | "envFiles">
  > &
    ApplicationOptions;
  private steps: Array<"env" | "security" | "database" | "migrations" | "composition" | "theme"> =
    [];

  constructor(options: ApplicationOptions = {}) {
    this.options = {
      rootDir: options.rootDir ?? process.cwd(),
      envFiles: options.envFiles ?? [".env", ".env.local"],
      ...options,
    };
  }

  withEnv(): this {
    return this.add("env");
  }

  withSecurity(): this {
    return this.add("security");
  }

  withDatabase(): this {
    return this.add("database");
  }

  withMigrationsCheck(): this {
    return this.add("migrations");
  }

  withComposition(): this {
    return this.add("composition");
  }

  withTheme(): this {
    return this.add("theme");
  }

  async build(): Promise<Application> {
    const order = [
      "env",
      "security",
      "database",
      "migrations",
      "composition",
      "theme",
    ] as const;
    const wanted = new Set(this.steps);
    const run = (s: (typeof order)[number]) =>
      wanted.size === 0 || wanted.has(s);

    let env!: NormalizedEnv;
    let db!: {
      manager: DatabaseManager;
      dbAdapter: DatabasePort;
      identityStore: IdentityStore;
      config: DatabaseConfig;
    };
    let compositionOverrideManager = new CompositionOverrideManager();

    // 1. Env — dotenv fill + canonical fail-fast validation.
    if (run("env")) {
      loadEnvFile(this.options.envFiles, this.options.rootDir);
      const source =
        this.options.env ??
        (process.env as Record<string, string | undefined>);
      env = validateEnv(source);
    }

    // 2. Security — production constraints before any I/O.
    if (run("security") && !this.options.skipSecurity) {
      SecurityGuard.enforceProductionConstraints();
    }

    // 3. Database — connect only, PRAGMAs awaited.
    if (run("database")) {
      const built = initDatabase({
        rootDir: this.options.rootDir,
        env: this.options.env,
      });
      await built.manager.ready();
      db = built;
    }

    // 4. Migrations check — verify, never migrate at boot (artisan owns DDL).
    if (run("migrations") && !this.options.skipMigrationsCheck && db) {
      const pending = await getPendingMigrationIds(db.dbAdapter);
      if (pending.length > 0) {
        throw new Error(
          `[boot] database not migrated (${pending.length} pending: ${pending.join(", ")}). ` +
            `Run "pnpm mosaix migrate" first (Laravel-style: artisan migrate before serve).`,
        );
      }
    }

    // 5. Composition overrides.
    if (run("composition") && !this.options.skipComposition) {
      compositionOverrideManager = new CompositionOverrideManager();
      loadSavedCompositionOverrides(compositionOverrideManager);
    }

    // 6. Persisted theme before serving traffic.
    if (run("theme") && !this.options.skipTheme) {
      await applyPersistedPlatformTheme();
    }

    return {
      rootDir: this.options.rootDir,
      env,
      manager: db.manager,
      dbAdapter: db.dbAdapter,
      identityStore: db.identityStore,
      config: db.config,
      compositionOverrideManager,
      providers: applicationProviders,
      close: () => closeDatabase(),
    };
  }

  private add(
    step: "env" | "security" | "database" | "migrations" | "composition" | "theme",
  ): this {
    if (!this.steps.includes(step)) this.steps.push(step);
    return this;
  }
}

/**
 * Full HTTP-serve chain: env → security → database → migrations check →
 * composition → theme. `src/start.ts` is a thin wrapper over this.
 */
export function createApplication(
  options: ApplicationOptions = {},
): Promise<Application> {
  return new ApplicationBuilder(options)
    .withEnv()
    .withSecurity()
    .withDatabase()
    .withMigrationsCheck()
    .withComposition()
    .withTheme()
    .build();
}

/**
 * Artisan-style chain for CLI commands (`mosaix migrate`, `db:seed`, …):
 * same env + security + database, but no migrations fail-fast (the CLI is
 * what APPLIES migrations) and no theme (no traffic served).
 */
export function createCliApplication(
  options: ApplicationOptions = {},
): Promise<Application> {
  return new ApplicationBuilder({
    ...options,
    skipMigrationsCheck: true,
    skipTheme: true,
  })
    .withEnv()
    .withSecurity()
    .withDatabase()
    .withComposition()
    .build();
}

export { closeDatabase };
