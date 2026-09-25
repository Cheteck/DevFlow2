import { z } from "zod";

/**
 * @mosaix/core — Canonical environment schema (extensible).
 *
 * Design goals (flexibility + extensibility):
 * - Single source of truth for documented env keys (mirrors `.env.example`).
 * - Backward-compatible aliases: canonical `MOSAIX_*` wins, legacy
 *   (`APP_PORT`, `PORT`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`) still
 *   accepted with a dev-time warning — never a silent break.
 * - Open for extension: BACs / plugins extend via `baseEnvSchema.extend({...})`
 *   or `validateEnv(source, extraSchema)` instead of forking this file.
 */

const portLike = z
  .union([z.string(), z.number()])
  .transform((v) => Number.parseInt(String(v), 10))
  .pipe(z.number().int().min(1).max(65535));

export const baseEnvSchema = z
  .object({
    // ── Runtime ──
    MOSAIX_ENV: z
      .enum(["development", "staging", "production"])
      .default("development"),
    NODE_ENV: z
      .enum(["development", "staging", "production", "test"])
      .optional(),
    MOSAIX_PORT: portLike.optional(),
    MOSAIX_COMPOSITION: z.string().min(1).default("community-platform"),
    MOSAIX_DEFAULT_BAC: z.string().min(1).default("solara"),
    MOSAIX_MAINTENANCE_MODE: z
      .union([z.string(), z.boolean()])
      .transform((v) => v === true || String(v).toLowerCase() === "true")
      .optional(),

    // ── Legacy port aliases (kept for compat, canonical = MOSAIX_PORT) ──
    APP_PORT: portLike.optional(),
    PORT: portLike.optional(),

    // ── Demo session (usermenu switcher, ?role=, /api/user/switch) ──
    // Empty = auto (enabled everywhere except production).
    MOSAIX_DEMO_USERS: z.union([z.string(), z.boolean()]).optional(),

    // ── Auth / secrets ──
    // Master encryption key (Laravel-style `base64:`). Managed with:
    // `pnpm key:generate` / `pnpm key:check`.
    MOSAIX_APP_KEY: z.string().min(1).optional(),
    MOSAIX_APP_CIPHER: z.enum(["AES-256-CBC", "AES-128-CBC"]).optional(),
    // Previous keys keep verifying during rotation (comma-separated).
    MOSAIX_APP_PREVIOUS_KEYS: z.string().optional(),
    MOSAIX_AUTH_JWT_SECRET: z.string().min(16).optional(),
    JWT_SECRET: z.string().min(16).optional(),
    // Previous JWT secrets accepted at verification during rotation.
    MOSAIX_AUTH_PREVIOUS_SECRETS: z.string().optional(),
    MOSAIX_SESSION_SECRET: z.string().min(16).optional(),
    MOSAIX_AUTH_TOKEN_TTL: z.coerce.number().int().positive().default(3600),
    MOSAIX_ADMIN_API_KEY: z.string().optional(),
    ADMIN_EMAIL: z.string().email().optional(),
    ADMIN_PASSWORD: z.string().min(12).optional(),

    // ── Data ──
    MOSAIX_DATABASE_URL: z.string().min(1).optional(),
    DATABASE_URL: z.string().min(1).optional(),
    MOSAIX_REDIS_URL: z.string().min(1).optional(),
    REDIS_URL: z.string().min(1).optional(),

    // ── HTTP ──
    CORS_ALLOWED_ORIGINS: z.string().optional(),
    TRUST_PROXY: z
      .union([z.string(), z.boolean()])
      .transform((v) => v === true || String(v).toLowerCase() === "true")
      .optional(),
    ALLOW_IN_MEMORY_IN_PRODUCTION: z
      .union([z.string(), z.boolean()])
      .transform((v) => v === true || String(v).toLowerCase() === "true")
      .optional(),

    // ── Payments / CDN ──
    PSP_WEBHOOK_SECRET: z.string().min(16).optional(),
    MOSAIX_CDN_SECRET: z.string().min(8).optional(),
    MOSAIX_CDN_BASE_URL: z.string().url().optional(),

    // ── OAuth (all optional — empty = disabled) ──
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    MICROSOFT_CLIENT_ID: z.string().optional(),
    MICROSOFT_CLIENT_SECRET: z.string().optional(),
    MICROSOFT_TENANT: z.string().optional(),
    APPLE_CLIENT_ID: z.string().optional(),
    APPLE_CLIENT_SECRET: z.string().optional(),
    APPLE_TEAM_ID: z.string().optional(),
    APPLE_KEY_ID: z.string().optional(),
    APPLE_PRIVATE_KEY: z.string().optional(),

    // ── Telemetry ──
    MOSAIX_TELEMETRY_OTLP_ENDPOINT: z
      .string()
      .url()
      .optional()
      .or(z.literal("")),
  })
  .passthrough();

export type BaseEnv = z.infer<typeof baseEnvSchema>;

export interface NormalizedEnv extends BaseEnv {
  resolvedPort: number;
  resolvedDatabaseUrl?: string;
  resolvedRedisUrl?: string;
  resolvedJwtSecret?: string;
  isProduction: boolean;
  usedLegacyAliases: string[];
}

function firstDefined(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === "string" && v.length > 0) return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

/**
 * Validate + normalize. `extraSchema` lets a BAC/plugin add its own keys
 * without editing this file: `validateEnv(process.env, z.object({ MY_KEY: z.string() }))`.
 * Throws fail-fast with formatted Zod errors.
 */
export function validateEnv(
  source: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
  extraSchema?: z.ZodTypeAny,
): NormalizedEnv {
  const shape =
    extraSchema && extraSchema instanceof z.ZodObject
      ? baseEnvSchema.extend((extraSchema as z.ZodObject<z.ZodRawShape>).shape)
      : baseEnvSchema;
  const parsed = (shape as z.ZodTypeAny).safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `[Env] Invalid environment:\n${JSON.stringify(parsed.error.format(), null, 2)}`,
    );
  }
  const env = parsed.data as BaseEnv;
  const usedLegacyAliases: string[] = [];

  const trackLegacy = (
    canonical: string | undefined,
    legacyKey: string,
    legacyVal: unknown,
  ) => {
    if (
      canonical === undefined &&
      legacyVal !== undefined &&
      String(legacyVal).length > 0
    ) {
      usedLegacyAliases.push(legacyKey);
    }
  };
  trackLegacy(
    env.MOSAIX_PORT as unknown as string | undefined,
    "APP_PORT",
    (source as Record<string, unknown>).APP_PORT,
  );
  trackLegacy(
    env.MOSAIX_PORT as unknown as string | undefined,
    "PORT",
    (source as Record<string, unknown>).PORT,
  );

  const portRaw = firstDefined(
    (env as Record<string, unknown>).MOSAIX_PORT,
    (source as Record<string, unknown>).APP_PORT,
    (source as Record<string, unknown>).PORT,
    "3000",
  );
  const resolvedPort = Number.parseInt(String(portRaw), 10) || 3000;

  const resolvedDatabaseUrl = firstDefined(
    env.MOSAIX_DATABASE_URL,
    env.DATABASE_URL,
  );
  const resolvedRedisUrl = firstDefined(env.MOSAIX_REDIS_URL, env.REDIS_URL);
  const resolvedJwtSecret = firstDefined(
    env.MOSAIX_AUTH_JWT_SECRET,
    env.JWT_SECRET,
  );

  const effectiveEnv = (env.MOSAIX_ENV ??
    env.NODE_ENV ??
    "development") as string;
  const isProduction =
    effectiveEnv === "production" || env.NODE_ENV === "production";

  if (usedLegacyAliases.length > 0 && !isProduction) {
    console.warn(
      `[Env] Legacy env aliases in use (${usedLegacyAliases.join(", ")}). Prefer canonical MOSAIX_* keys — see .env.example.`,
    );
  }

  return {
    ...env,
    resolvedPort,
    resolvedDatabaseUrl,
    resolvedRedisUrl,
    resolvedJwtSecret,
    isProduction,
    usedLegacyAliases,
  };
}

export function resolvePort(
  source: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): number {
  return validateEnv(source).resolvedPort;
}
