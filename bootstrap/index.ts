/**
 * bootstrap — Laravel-style composition root (`bootstrap/app.php`).
 *
 * Public entry:
 * - `createApplication()` — full HTTP-serve chain (env → security →
 *   database → migrations fail-fast → composition → theme).
 * - `createCliApplication()` — artisan-style chain for CLI commands
 *   (same env + security + database, no migrations fail-fast, no theme).
 * - `ApplicationBuilder` — fluent subset/ordering for tests and CLIs.
 */

export {
  ApplicationBuilder,
  applicationProviders,
  closeDatabase,
  createApplication,
  createCliApplication,
  type Application,
  type ApplicationOptions,
  type BootStep,
  type ProviderDescriptor,
} from "./app.js";

export {
  initSharedAuth,
  getSharedAuthManager,
  resetSharedAuth,
} from "./auth-composition.js";
