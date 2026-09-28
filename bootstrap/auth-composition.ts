/**
 * bootstrap/auth-composition — Shared Auth Composition Root (ADR-0017 AUTH-01).
 *
 * Provides a single shared AuthManager and SessionStore instance across the platform
 * (Shell, Gateway, and Citadelle BAC) using MosaiX container DI.
 */

import { container } from "@mosaix/container";
import { AuthManager, JwtService } from "@mosaix/auth";
import type { DatabasePort } from "@mosaix/ports-database";

export interface SharedAuthCompositionOptions {
  dbAdapter?: DatabasePort;
  jwtSecret?: string;
}

let sharedAuthInstance: AuthManager | null = null;

export function initSharedAuth(options: SharedAuthCompositionOptions = {}): AuthManager {
  if (sharedAuthInstance) return sharedAuthInstance;

  let db: DatabasePort | undefined = options.dbAdapter;
  if (!db && container.has("databasePort")) {
    db = container.resolve<DatabasePort>("databasePort");
  }

  const jwtSecret =
    options.jwtSecret ||
    process.env.MOSAIX_AUTH_JWT_SECRET ||
    "default_dev_jwt_secret_mosaix_platform_32_bytes";

  const jwtService = new JwtService({ secret: jwtSecret });
  const authManager = new AuthManager({
    jwtService,
  });

  container.singleton("authManager", () => authManager);
  sharedAuthInstance = authManager;
  return authManager;
}

export function getSharedAuthManager(): AuthManager {
  if (!sharedAuthInstance) {
    return initSharedAuth();
  }
  return sharedAuthInstance;
}

export function resetSharedAuth(): void {
  sharedAuthInstance = null;
}
