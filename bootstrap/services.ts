/**
 * @mosaix/bootstrap — Service & Dependency Container / Registrar
 * Registers global core services, verifies platform security, initializes database & migrations.
 */

import { CompositionOverrideManager } from "@mosaix/core";
import { SecurityGuard } from "../src/shell/security-guard.js";
import { databaseReady } from "../src/shell/database-bootstrap.js";
import { getPendingMigrationIds } from "../src/shell/migrations.js";
import { applyPersistedPlatformTheme } from "../src/shell/theme/theme-persistence.js";
import { loadSavedCompositionOverrides } from "../src/shell/editor.js";
import { getFeedService } from "../src/shell/feed-service.js";
import { distributedEventBackplane } from "../src/shell/event-backplane.js";
import { getAnonymizationOrchestrator } from "../src/shell/anonymization-orchestrator.js";
import { createPlatformAuthComposition, type PlatformAuthComposition } from "./auth-composition.js";

export interface ApplicationServices {
  compositionOverrideManager: CompositionOverrideManager;
  authComposition: PlatformAuthComposition;
  getFeedService: typeof getFeedService;
  eventBackplane: typeof distributedEventBackplane;
  getAnonymizationOrchestrator: typeof getAnonymizationOrchestrator;
}

export async function registerServices(): Promise<ApplicationServices> {
  // Enforce production security constraints (VULN-08)
  SecurityGuard.enforceProductionConstraints();

  // Database verification & theme application
  const { dbAdapter } = await databaseReady();
  const pendingMigrations = await getPendingMigrationIds(dbAdapter);
  if (pendingMigrations.length > 0) {
    throw new Error(
      `[boot] database not migrated (${pendingMigrations.length} pending: ${pendingMigrations.join(", ")}). ` +
        `Run "pnpm mosaix migrate" first (Laravel-style: artisan migrate before serve).`,
    );
  }
  await applyPersistedPlatformTheme();

  // Composition Overrides Store initialization
  const compositionOverrideManager = new CompositionOverrideManager();
  loadSavedCompositionOverrides(compositionOverrideManager);

  // Platform Authentication & Identity Composition Root
  const authComposition = createPlatformAuthComposition(dbAdapter);

  return {
    compositionOverrideManager,
    authComposition,
    getFeedService,
    eventBackplane: distributedEventBackplane,
    getAnonymizationOrchestrator,
  };
}
