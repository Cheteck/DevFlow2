/**
 * @mosaix/bootstrap — Core Service Providers Configuration
 * Inspired by Laravel bootstrap/providers.php & Service Providers lifecycle.
 */

import {
  CompositionOverrideManager,
  loadEnvFile,
  validateEnv,
} from "@mosaix/core";
import { SecurityGuard } from "../src/shell/security-guard.js";
import { databaseReady } from "../src/shell/database-bootstrap.js";
import { getPendingMigrationIds } from "../src/shell/migrations.js";
import { applyPersistedPlatformTheme } from "../src/shell/theme/theme-persistence.js";
import { loadSavedCompositionOverrides } from "../src/shell/editor.js";
import type { MosaixApplication } from "./app.js";

export interface ServiceProvider {
  name: string;
  register?(app: MosaixApplication): Promise<void> | void;
  boot?(app: MosaixApplication): Promise<void> | void;
}

/**
 * Environment Service Provider — loads `.env` and validates environment variables.
 */
export const EnvironmentServiceProvider: ServiceProvider = {
  name: "EnvironmentServiceProvider",
  register() {
    loadEnvFile();
  },
  boot(app) {
    const bootEnv = validateEnv(process.env as Record<string, string | undefined>);
    app.setConfig("env", bootEnv);
  },
};

/**
 * Security Service Provider — enforces OWASP & production security invariants.
 */
export const SecurityServiceProvider: ServiceProvider = {
  name: "SecurityServiceProvider",
  boot() {
    SecurityGuard.enforceProductionConstraints();
  },
};

/**
 * Database Service Provider — initializes database connection and verifies migrations.
 */
export const DatabaseServiceProvider: ServiceProvider = {
  name: "DatabaseServiceProvider",
  async boot(app) {
    const { dbAdapter, identityStore, manager } = await databaseReady();
    const pendingMigrations = await getPendingMigrationIds(dbAdapter);
    if (pendingMigrations.length > 0) {
      throw new Error(
        `[boot] database not migrated (${pendingMigrations.length} pending: ${pendingMigrations.join(", ")}). ` +
          `Run "pnpm mosaix migrate" first (Laravel-style: artisan migrate before serve).`,
      );
    }
    app.setService("dbAdapter", dbAdapter);
    app.setService("identityStore", identityStore);
    app.setService("databaseManager", manager);
  },
};

/**
 * Theme Service Provider — applies saved platform theme settings.
 */
export const ThemeServiceProvider: ServiceProvider = {
  name: "ThemeServiceProvider",
  async boot() {
    await applyPersistedPlatformTheme();
  },
};

/**
 * Composition Service Provider — initializes layout & UI composition overrides.
 */
export const CompositionServiceProvider: ServiceProvider = {
  name: "CompositionServiceProvider",
  boot(app) {
    const manager = new CompositionOverrideManager();
    loadSavedCompositionOverrides(manager);
    app.setService("compositionOverrideManager", manager);
  },
};

/**
 * Default Service Providers registered during framework application bootstrap.
 */
export const providers: ServiceProvider[] = [
  EnvironmentServiceProvider,
  SecurityServiceProvider,
  DatabaseServiceProvider,
  ThemeServiceProvider,
  CompositionServiceProvider,
];
