import { z } from "zod";

export const imperiaPolicyUpdatedSchema = z
  .object({
    policyId: z.string().min(1),
    action: z.enum(["updated", "deprecated"]),
    changedBy: z.string().min(1),
    timestamp: z.string().datetime({ offset: true }),
  })
  .strict();

export const imperiaAuditLoggedSchema = z
  .object({
    auditId: z.string().min(1),
    action: z.string().min(1),
    actorId: z.string().min(1),
    targetId: z.string().optional(),
    timestamp: z.string().datetime({ offset: true }),
  })
  .strict();

export const imperiaEventPayloadSchemas = {
  "imperia.policy.updated": imperiaPolicyUpdatedSchema,
  "imperia.audit.logged": imperiaAuditLoggedSchema,
} as const;
