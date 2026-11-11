/**
 * @apps/citadelle — Citadelle Policy Evaluator (BOUND-07)
 * Guardrail ensuring Citadelle issues identity claims only and defers domain roles to BACs.
 */

export interface PolicyEvaluationContext {
  userId: string;
  requestedRoles: string[];
  tenantId?: string;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  permittedRoles: string[];
  rejectedRoles: string[];
  reason?: string;
}

// Allowed identity roles natively emitted by Citadelle. Business roles (merchant, delivery_partner)
// must be granted by domain BACs (Spaces, Commerce) per BOUND-07.
const NATIVE_IDENTITY_ROLES = new Set(["citizen", "member", "admin"]);

export class CitadellePolicyEvaluator {
  evaluate(context: PolicyEvaluationContext): PolicyEvaluationResult {
    const permittedRoles: string[] = [];
    const rejectedRoles: string[] = [];

    for (const role of context.requestedRoles) {
      if (NATIVE_IDENTITY_ROLES.has(role)) {
        permittedRoles.push(role);
      } else {
        rejectedRoles.push(role);
      }
    }

    if (rejectedRoles.length > 0) {
      return {
        allowed: false,
        permittedRoles,
        rejectedRoles,
        reason: `Business roles [${rejectedRoles.join(", ")}] must be granted by domain BACs, not Citadelle (BOUND-07).`,
      };
    }

    return {
      allowed: true,
      permittedRoles,
      rejectedRoles: [],
    };
  }
}

export const citadellePolicyEvaluator = new CitadellePolicyEvaluator();
