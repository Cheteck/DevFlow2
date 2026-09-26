/**
 * @mosaix/bootstrap — Configuration Loader & Validator
 * Handles environment variable loading and validation in a deterministic, fail-fast manner.
 */

import { loadEnvFile, validateEnv } from "@mosaix/core";

export type ApplicationEnv = ReturnType<typeof validateEnv>;

export interface ApplicationConfig {
  env: ApplicationEnv;
  port: number;
}

export function loadConfiguration(): ApplicationConfig {
  // Load `.env` files first (zero-dep)
  loadEnvFile();

  // Canonical env validation (fail-fast)
  const env = validateEnv(process.env as Record<string, string | undefined>);

  return {
    env,
    port: env.resolvedPort,
  };
}
