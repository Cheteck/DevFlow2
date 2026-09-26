/**
 * @mosaix/bootstrap — Core Application Bootstrapper Module
 * Inspired by Laravel bootstrap directory pattern.
 */

export {
  createApplication,
  bootstrapApplication,
  MosaixApplication,
  type ApplicationOptions,
  type ApplicationServices,
  type EnvConfig,
} from "./app.js";

export {
  providers,
  EnvironmentServiceProvider,
  SecurityServiceProvider,
  DatabaseServiceProvider,
  ThemeServiceProvider,
  CompositionServiceProvider,
  type ServiceProvider,
} from "./providers.js";
