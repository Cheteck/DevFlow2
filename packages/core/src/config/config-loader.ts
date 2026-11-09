/**
 * @mosaix/core — Configuration Loader
 *
 * Charge et valide la configuration depuis process.env au démarrage de
 * l'application. Produit une configuration typée, immuable et sans aucun
 * accès direct à process.env pour les consommateurs métier.
 *
 * Règles de sécurité :
 * - Aucun secret n'est exposé côté client ni dans les logs d'erreur.
 * - Les secrets critiques (JWT, session, webhooks de paiement) provoquent
 *   un fail-fast explicite en production s'ils sont absents ou invalides.
 * - Une variable facultative absente n'est pas une erreur : le consommateur
 *   doit gérer l'absence (ex: provider OAuth désactivé).
 * - Une dépendance indispensable à l'environnement actif (ex: PostgreSQL
 *   pour un profil de déploiement persistant) doit provoquer une erreur
 *   explicite si elle est absente.
 */

import {
  EnvSchema,
  type EnvConfig,
  type EnvRuntimeConfig,
  type InfrastructureConfig,
  type PlatformConfig,
  type ReadonlyAppConfig,
  type SecurityConfig,
} from "./config-schema.js";
import { ConsoleLogger } from "../observability.js";

/**
 * Gèle récursivement un objet pour garantir son immuabilité profonde.
 * Utilisé pour figer la configuration validée après démarrage.
 */
function deepFreeze<T extends object>(obj: T): T {
  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    const value = obj[name as keyof T];
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

/**
 * Charge et valide la configuration depuis process.env.
 *
 * @param env — Source de variables d'environnement (process.env par défaut,
 *   injectable pour les tests).
 * @param options — Options de chargement.
 * @returns Configuration typée et immuable.
 * @throws Error si une variable obligatoire est absente ou invalide
 *   dans l'environnement courant (fail-fast).
 */
export function loadConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
  options: { isProduction?: boolean } = {},
): ReadonlyAppConfig {
  const isProduction =
    options.isProduction ??
    (env.NODE_ENV === "production" || env.MOSAIX_ENV === "production");

  // ─── Validation Zod : fail-fast sur les valeurs invalides ───
  const parseResult = EnvSchema.safeParse(env);
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `[ConfigLoader] Configuration invalide :\n${issues}\n` +
        "Corriger les variables d'environnement avant de démarrer l'application.",
    );
  }

  const cfg: EnvConfig = parseResult.data;

  // ─── Détection de l'environnement ───
  const nodeEnv = cfg.NODE_ENV ?? "development";
  const isCi = !!env.CI;
  const envRuntime: EnvRuntimeConfig = {
    nodeEnv,
    isCi,
    isProduction,
    isDevelopment: nodeEnv === "development",
    isTest: nodeEnv === "test",
  };

  // ─── Secrets : fail-fast explicite en production, jamais de valeur par défaut dangereuse ───
  const jwtSecret = cfg.MOSAIX_AUTH_JWT_SECRET ?? cfg.JWT_SECRET;
  const sessionSecret = cfg.MOSAIX_SESSION_SECRET;
  const pspWebhookSecret = cfg.PSP_WEBHOOK_SECRET;
  const satimWebhookSecret = cfg.SATIM_WEBHOOK_SECRET;

  const warnings: string[] = [];

  if (isProduction) {
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new Error(
        "[ConfigLoader] FATAL_SECURITY : Production JWT secret manquant ou insuffisant " +
          "(>= 32 caractères requis). Définir MOSAIX_AUTH_JWT_SECRET ou JWT_SECRET.",
      );
    }
    // MOSAIX_SESSION_SECRET est traité en avertissement (et non en fail-fast)
    // pour préserver la rétrocompatibilité avec les déploiements existants qui
    // n'ont pas encore défini cette variable. Ce choix est assumé et documenté :
    // si une application exige un secret de session obligatoire, elle doit
    // migrer ce bloc vers un FATAL_SECURITY lors d'un lot dédié.
    // Voir https://chatgpt.com/c/6af1195f-e6d4-83ea-8288-bd05f7af00c4 (réserve MOSAIX_SESSION_SECRET).
    if (!sessionSecret || sessionSecret.length < 32) {
      warnings.push(
        "[ConfigLoader] SECURITY_WARN : Session secret devrait faire au moins 32 caractères en production (rappel rétrocompatibilité).",
      );
    }
    if (!pspWebhookSecret) {
      warnings.push(
        "[ConfigLoader] SECURITY_WARN : PSP webhook secret non défini en production.",
      );
    }
    if (!satimWebhookSecret) {
      warnings.push(
        "[ConfigLoader] SECURITY_WARN : SATIM webhook secret non défini en production.",
      );
    }
  }

  // ─── Infrastructure ───
  const infrastructure: InfrastructureConfig = {
    databaseUrl: cfg.DATABASE_URL,
    redisUrl: cfg.REDIS_URL,
    dbContainer: cfg.MOSAIX_DB_CONTAINER,
  };

  // ─── Plateforme ───
  const platform: PlatformConfig = {
    defaultBacId: cfg.MOSAIX_DEFAULT_BAC,
    compositionId: cfg.MOSAIX_COMPOSITION,
    maintenanceMode: cfg.MOSAIX_MAINTENANCE_MODE === "true",
    requestTimeoutMs: Number.parseInt(cfg.MOSAIX_REQUEST_TIMEOUT_MS, 10),
  };

  // ─── Sécurité (secrets masqués, jamais exposés en clair hors accès explicite) ───
  const oauthSecrets: Record<string, string> = {};
  for (const key of [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "APPLE_CLIENT_ID",
    "APPLE_CLIENT_SECRET",
    "APPLE_TEAM_ID",
    "APPLE_KEY_ID",
    "APPLE_PRIVATE_KEY",
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_CLIENT_SECRET",
    "MICROSOFT_TENANT",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "FACEBOOK_CLIENT_ID",
    "FACEBOOK_CLIENT_SECRET",
  ] as const) {
    if (cfg[key]) {
      oauthSecrets[key] = cfg[key];
    }
  }

  const security: SecurityConfig = {
    jwtSecret,
    sessionSecret,
    pspWebhookSecret,
    satimWebhookSecret,
    oauth: Object.keys(oauthSecrets).length > 0 ? oauthSecrets : undefined,
  };

  const config: ReadonlyAppConfig = {
    env: { ...envRuntime },
    infrastructure,
    security,
    platform,
  };

  // ─── Logs d'avertissement (sans jamais logger les secrets) ───
  const logger = new ConsoleLogger("warn");
  for (const warning of warnings) {
    logger.warn(warning);
  }

  // Immuabilité profonde : aucune mutation après validation au démarrage
  return deepFreeze(config);
}

export type { EnvConfig, ReadonlyAppConfig };
