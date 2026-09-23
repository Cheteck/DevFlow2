export interface GovernancePolicy {
  id: string;
  name: string;
  description: string;
  targetScope: string; // e.g. "apps/*", "packages/core"
  effect: "allow" | "deny";
  rules: Array<{
    field: string;
    operator: "equals" | "contains" | "matches";
    value: string;
  }>;
  enabled: boolean;
}

export class GovernancePolicyRegistry {
  private policies = new Map<string, GovernancePolicy>();

  registerPolicy(policy: GovernancePolicy): void {
    this.policies.set(policy.id, policy);
  }

  getPolicy(id: string): GovernancePolicy | undefined {
    return this.policies.get(id);
  }

  listPolicies(): GovernancePolicy[] {
    return Array.from(this.policies.values());
  }

  evaluate(scope: string, context: Record<string, unknown> = {}): boolean {
    const applicable = this.listPolicies().filter((p) => p.enabled && (p.targetScope === "*" || p.targetScope === scope));

    for (const policy of applicable) {
      // Evaluate each rule against the context
      let rulesMatched = true;
      for (const rule of policy.rules) {
        const val = String(context[rule.field] ?? "");
        if (rule.operator === "equals" && val !== rule.value) {
          rulesMatched = false;
          break;
        } else if (rule.operator === "contains" && !val.includes(rule.value)) {
          rulesMatched = false;
          break;
        } else if (rule.operator === "matches" && !new RegExp(rule.value).test(val)) {
          rulesMatched = false;
          break;
        }
      }

      if (rulesMatched) {
        if (policy.effect === "deny") {
          return false;
        }
      }
    }
    return true;
  }
}
