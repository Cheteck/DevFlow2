import { z } from "zod";

export const ApplicationManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/, "Version must be a valid SemVer"),
  type: z.string().optional(),
  domain: z.union([z.string(), z.record(z.unknown())]).optional(),
  runtime: z
    .object({
      entrypoint: z.string().min(1),
      isolation: z.string().optional(),
    })
    .passthrough(),
  requires: z.array(z.object({ id: z.string(), version: z.string() })).optional(),
  capabilities: z
    .array(z.union([z.string(), z.record(z.unknown())]))
    .optional(),
  permissions: z
    .array(
      z.union([
        z.string().regex(/^[^:]+:[^:]+:[^:]+:[^:]+$/, "Permission must follow 4-part grammar (domain:resource:action:scope)"),
        z.object({
          permission: z.string().regex(/^[^:]+:[^:]+:[^:]+:[^:]+$/, "Permission must follow 4-part grammar"),
          category: z.string().optional(),
          scope: z.string().optional(),
          description: z.string().optional(),
          wildcard: z.boolean().optional(),
        }).passthrough(),
      ])
    )
    .optional(),
  events: z
    .union([
      z.array(z.string()),
      z.object({
        publishes: z.array(z.string()).optional(),
        subscribes: z.array(z.string()).optional(),
      }).passthrough(),
    ])
    .optional(),
  database: z.record(z.unknown()).optional(),
  experience: z.record(z.unknown()).optional(),
  routes: z.union([
    z.array(z.object({ path: z.string(), method: z.string().optional(), handler: z.string().optional() })),
    z.object({ prefix: z.string().optional() }).passthrough(),
  ]).optional(),
  metadata: z.record(z.unknown()).optional(),
  themeContract: z.string().optional(),
  themeOverrides: z
    .object({
      slots: z.array(z.string()).optional(),
      tokens: z.string().optional(),
      layouts: z.record(z.string()).optional(),
      routes: z.array(z.string()).optional(),
    })
    .optional(),
}).passthrough();

export const PluginManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/, "Version must be a valid SemVer"),
  extension: z.object({
    target: z.string().min(1),
    point: z.union([z.string().min(1), z.array(z.string().min(1))]),
    hooks: z.array(z.string()).optional(),
  }),
  entrypoint: z.string().optional(),
  slots: z.array(z.unknown()).optional(),
  contributions: z.array(z.unknown()).optional(),
}).passthrough();

export const MosaixEventEnvelopeSchema = z.object({
  id: z.string(),
  type: z.string(),
  version: z.string(),
  source: z.union([
    z.string(),
    z.object({
      application: z.string(),
      instance: z.string().optional(),
    }),
  ]),
  timestamp: z.string(),
  payload: z.unknown(),
  tenant: z.union([
    z.string(),
    z.object({
      organizationId: z.string(),
      spaceId: z.string().optional(),
      tenantId: z.string().optional(),
    }),
  ]).optional(),
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  security: z.record(z.unknown()).optional(),
});

export const ThemeTargetSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
});

export const ThemeModeSchema = z.enum(["light", "dark", "system"]);

export const ColorTokensSchema = z.object({
  primary: z.string().min(1),
  primaryHover: z.string().optional(),
  onPrimary: z.string().optional(),
  secondary: z.string().optional(),
  onSecondary: z.string().optional(),
  background: z.string().optional(),
  surface: z.string().optional(),
  text: z.string().optional(),
  textMuted: z.string().optional(),
  muted: z.string().optional(),
  border: z.string().optional(),
  accent: z.string().optional(),
  danger: z.string().optional(),
  error: z.string().optional(),
  warning: z.string().optional(),
  success: z.string().optional(),
}).passthrough();

export const PartialColorTokensSchema = ColorTokensSchema.partial();

export const DesignTokensSchema = z.object({
  colors: ColorTokensSchema,
  typography: z.record(z.unknown()).optional(),
  spacing: z.record(z.unknown()).optional(),
  radius: z.record(z.unknown()).optional(),
  shadows: z.record(z.unknown()).optional(),
  motion: z.record(z.unknown()).optional(),
  tailwind: z.record(z.string()).optional(),
}).passthrough();

export const PartialDesignTokensSchema = z.object({
  colors: PartialColorTokensSchema.optional(),
  typography: z.record(z.unknown()).optional(),
  spacing: z.record(z.unknown()).optional(),
  radius: z.record(z.unknown()).optional(),
  shadows: z.record(z.unknown()).optional(),
  motion: z.record(z.unknown()).optional(),
  tailwind: z.record(z.string()).optional(),
}).passthrough();

export const ThemeManifestModesSchema = z.object({
  light: PartialDesignTokensSchema.optional(),
  dark: PartialDesignTokensSchema.optional(),
}).strict();

export const ThemeManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/, "Version must be a valid SemVer"),
  contractVersion: z.string().optional(),
  tokens: DesignTokensSchema.optional(),
  modes: ThemeManifestModesSchema.optional(),
  assets: z.record(z.unknown()).optional(),
  extends: z.string().optional(),
  accessibility: z.record(z.unknown()).optional(),
}).passthrough();

export const ThemeAssignmentSchema = z.object({
  target: ThemeTargetSchema,
  themeId: z.string().min(1),
  version: z.string().optional(),
  mode: ThemeModeSchema.optional(),
  source: z.enum(["platform", "admin", "user", "application"]).or(z.string()),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
});

export const ThemeChangedPayloadSchema = z.object({
  theme: z.string(),
  mode: z.string(),
  version: z.string(),
  appliedAt: z.string(),
  target: ThemeTargetSchema.optional(),
}).passthrough();



export const ThemeAssignmentChangedPayloadSchema = z.object({
  target: ThemeTargetSchema,
  assignment: ThemeAssignmentSchema.optional(),
  at: z.string(),
  changedBy: z.string().optional(),
}).passthrough();
