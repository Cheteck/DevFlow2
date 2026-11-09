/**
 * @mosaix/core — Configuration Schema
 *
 * Schémas de validation Zod pour la configuration chargée depuis
 * l'environnement au démarrage de l'application.
 *
 * Ce fichier ne contient aucune logique de lecture de process.env :
 * il définit uniquement les contrats de validation. Le chargement
 * depuis process.env est de la responsabilité de config-loader.ts.
 */

import { z } from "zod";

// ─── Schéma d'environnement (lecture unique au démarrage, fail-fast) ───

export const EnvSchema = z.object({
  // ─── Infrastructure (obligatoires selon le profil de déploiement) ───
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  MOSAIX_DB_CONTAINER: z.string().default("mosaix-db-1"),

  // ─── Secrets (obligatoires en production, jamais de valeur par défaut dangereuse) ───
  MOSAIX_AUTH_JWT_SECRET: z.string().min(32).optional(),
  JWT_SECRET: z.string().min(32).optional(),
  MOSAIX_SESSION_SECRET: z.string().min(32).optional(),
  PSP_WEBHOOK_SECRET: z.string().min(16).optional(),
  SATIM_WEBHOOK_SECRET: z.string().min(16).optional(),

  // ─── OAuth (optionnels : absence désactive le provider) ───
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_SECRET: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_CLIENT_ID: z.string().optional(),
  FACEBOOK_CLIENT_SECRET: z.string().optional(),

  // ─── Environnement ───
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MOSAIX_ENV: z.enum(["development", "test", "production"]).optional(),
  CI: z.string().optional(),

  // ─── Sécurité réseau ───
  TRUST_PROXY: z.union([z.literal("true"), z.literal("false")]).optional(),
  MOSAIX_TRUST_PROXY: z.union([z.literal("true"), z.literal("false")]).optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),

  // ─── Plateforme ───
  MOSAIX_DEFAULT_BAC: z.string().default("solara"),
  MOSAIX_COMPOSITION: z.string().default("community-platform"),
  MOSAIX_MAINTENANCE_MODE: z.union([z.literal("true"), z.literal("false")]).optional(),
  MOSAIX_REQUEST_TIMEOUT_MS: z.string().regex(/^\d+$/).default("30000"),

  // ─── Runtime terminal (pas de configuration métier) ───
  NO_TUI: z.string().optional(),
  NO_COLOR: z.string().optional(),
  TERM: z.string().optional(),
  DEBUG: z.string().optional(),

  // ─── Scripts / setup ───
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

// ─── Configuration validée et immuable exposée aux consommateurs ───

export interface InfrastructureConfig {
  readonly databaseUrl?: string;
  readonly redisUrl?: string;
  readonly dbContainer: string;
}

export interface SecurityConfig {
  readonly jwtSecret?: string;
  readonly sessionSecret?: string;
  readonly pspWebhookSecret?: string;
  readonly satimWebhookSecret?: string;
  /**
   * Secrets OAuth par fournisseur (clé = nom du fournisseur, ex: "GOOGLE_CLIENT_ID").
   * Lus depuis les variables d'environnement et exposés via ConfigService.
   */
  readonly oauth?: Record<string, string>;
}

export interface PlatformConfig {
  readonly defaultBacId: string;
  readonly compositionId: string;
  readonly maintenanceMode: boolean;
  readonly requestTimeoutMs: number;
}

export interface EnvRuntimeConfig {
  readonly nodeEnv: "development" | "test" | "production";
  readonly isCi: boolean;
  readonly isProduction: boolean;
  readonly isDevelopment: boolean;
  readonly isTest: boolean;
}

export interface ReadonlyAppConfig {
  readonly env: EnvRuntimeConfig;
  readonly infrastructure: InfrastructureConfig;
  readonly security: SecurityConfig;
  readonly platform: PlatformConfig;
}
