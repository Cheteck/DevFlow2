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
