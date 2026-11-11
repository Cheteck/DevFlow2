/**
 * @mosaix/core — Configuration Module
 *
 * Point d'entrée unique pour la configuration centralisée de MosaiX.
 *
 * Ce module expose :
 * - `loadConfig(env?, options?)` : charge et valide la configuration depuis
 *   process.env au démarrage. Produit une configuration typée et immuable.
 * - `EnvSchema` : schéma Zod de validation (réutilisable par les tests).
 * - Types : `EnvConfig`, `ReadonlyAppConfig`, `InfrastructureConfig`,
 *   `SecurityConfig`, `PlatformConfig`, `EnvRuntimeConfig`.
 *
 * Aucun consommateur métier ne doit lire `process.env` directement : la
 * configuration est injectée via ce module au point de composition
 * (src/start.ts) puis distribuée aux composants qui en ont besoin.
 */

export { loadConfig, type EnvConfig, type ReadonlyAppConfig } from "./config-loader.js";
export { EnvSchema, type InfrastructureConfig, type SecurityConfig, type PlatformConfig, type EnvRuntimeConfig } from "./config-schema.js";
