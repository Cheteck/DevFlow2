export interface RegoRule {
  id: string;
  name: string;
  condition: (context: Record<string, unknown>) => boolean;
  effect: "ALLOW" | "DENY";
  message?: string;
}

export class RegoPolicyEvaluator {
  private rules: RegoRule[] = [];

  addRule(rule: RegoRule): void {
    this.rules.push(rule);
  }

  evaluate(context: Record<string, unknown>): { allowed: boolean; violations: string[] } {
    const violations: string[] = [];
    for (const rule of this.rules) {
      const match = rule.condition(context);
      if (rule.effect === "DENY" && match) {
        violations.push(rule.message ?? `Policy [${rule.name}] violated.`);
      }
    }
    return {
      allowed: violations.length === 0,
      violations,
    };
  }

  static createStandardComplianceEvaluator(): RegoPolicyEvaluator {
    const evaluator = new RegoPolicyEvaluator();

    // Rule 1: Admins must have MFA verified (SOC 2 CC6.1)
    evaluator.addRule({
      id: "RULE_MFA_ADMIN",
      name: "Enforce MFA for Admins",
      condition: (ctx) => ctx.role === "admin" && ctx.mfaVerified !== true,
      effect: "DENY",
      message: "SOC 2 Violation: Administrators must authenticate with Multi-Factor Authentication (MFA).",
    });

    // Rule 2: Production export restriction (ISO 27001 A.8.2.3)
    evaluator.addRule({
      id: "RULE_PROD_EXPORT",
      name: "Restrict Bulk Production Data Export",
      condition: (ctx) => ctx.action === "bulk_export" && ctx.environment === "production" && ctx.role !== "compliance_officer",
      effect: "DENY",
      message: "ISO 27001 Violation: Bulk export of production data requires Compliance Officer authorization.",
    });

    // Rule 3: HIPAA PHI Access Logging
    evaluator.addRule({
      id: "RULE_HIPAA_PHI_AUDIT",
      name: "Enforce PHI Access Audit Logging",
      condition: (ctx) => ctx.containsPhi === true && ctx.auditLogged !== true,
      effect: "DENY",
      message: "HIPAA Security Rule Violation: Access to Protected Health Information must be synchronously audit-logged.",
    });

    return evaluator;
  }
}


export interface TenantBudgetQuota {
  tenantId: string;
  monthlyBudgetEur: number;
  currentSpendEur: number;
}

export class CostGovernanceQuotaManager {
  private budgets = new Map<string, TenantBudgetQuota>();

  setBudget(tenantId: string, monthlyBudgetEur: number): void {
    this.budgets.set(tenantId, {
      tenantId,
      monthlyBudgetEur,
      currentSpendEur: 0,
    });
  }

  recordSpend(tenantId: string, amountEur: number): { quotaExceeded: boolean; usagePercent: number } {
    const quota = this.budgets.get(tenantId);
    if (!quota) {
      return { quotaExceeded: false, usagePercent: 0 };
    }
    quota.currentSpendEur += amountEur;
    const usagePercent = Math.round((quota.currentSpendEur / quota.monthlyBudgetEur) * 100);
    return {
      quotaExceeded: quota.currentSpendEur > quota.monthlyBudgetEur,
      usagePercent,
    };
  }
}

export interface IncidentRunbook {
  incidentType: string;
  severity: "SEV1" | "SEV2" | "SEV3";
  steps: string[];
  postMortemTemplate: string;
}

export class IncidentRunbookRegistry {
  private runbooks = new Map<string, IncidentRunbook>();

  registerRunbook(runbook: IncidentRunbook): void {
    this.runbooks.set(runbook.incidentType, runbook);
  }

  getRunbook(incidentType: string): IncidentRunbook | undefined {
    return this.runbooks.get(incidentType);
  }
}
