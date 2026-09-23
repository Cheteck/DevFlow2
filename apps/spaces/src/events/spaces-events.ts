import { z } from "zod";

export const spacesSpaceCreatedSchema = z
  .object({
    spaceId: z.string().min(1),
    name: z.string().min(1),
    ownerUserId: z.string().min(1),
    templateId: z.string().optional(),
    category: z.string().optional(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const spacesModuleEnabledSchema = z
  .object({
    spaceId: z.string().min(1),
    capabilityId: z.string().min(1),
    enabledAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const spacesModuleDisabledSchema = z
  .object({
    spaceId: z.string().min(1),
    capabilityId: z.string().min(1),
    disabledAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const spacesEventPayloadSchemas = {
  "spaces.space.created": spacesSpaceCreatedSchema,
  "spaces.module.enabled": spacesModuleEnabledSchema,
  "spaces.module.disabled": spacesModuleDisabledSchema,
} as const;
