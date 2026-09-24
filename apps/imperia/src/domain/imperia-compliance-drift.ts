export type ComplianceFramework = "SOC2" | "ISO27001" | "GDPR" | "HIPAA";

export interface ComplianceControl {
  framework: ComplianceFramework;
  controlId: string;
  name: string;
  description: string;
  checkFn: (state: Record<string, unknown>) => { compliant: boolean; remediation?: string };
}

export interface DriftReport {
  timestamp: string;
  totalChecked: number;
  driftDetected: boolean;
  discrepancies: Array<{
    key: string;
    desired: unknown;
    actual: unknown;
    severity: "low" | "medium" | "high" | "critical";
  }>;
}

/**
 * GitOps Drift Detection Engine
 * Compares desired declarative configuration against actual runtime state
 */
export class GitOpsDriftDetector {
  static compare(
    desiredState: Record<string, unknown>,
    actualState: Record<string, unknown>,
  ): DriftReport {
    const discrepancies: DriftReport["discrepancies"] = [];

    for (const [key, desiredVal] of Object.entries(desiredState)) {
      const actualVal = actualState[key];
      const desiredStr = JSON.stringify(desiredVal);
      const actualStr = JSON.stringify(actualVal);

      if (desiredStr !== actualStr) {
        discrepancies.push({
          key,
          desired: desiredVal,
          actual: actualVal,
          severity: key.includes("security") || key.includes("permission") ? "critical" : "medium",
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      totalChecked: Object.keys(desiredState).length,
      driftDetected: discrepancies.length > 0,
      discrepancies,
    };
  }
}

/**
 * Change Management Workflow
 * Lifecycle: PROPOSED -> REVIEWED -> APPROVED -> DEPLOYED -> VERIFIED
 */
export type ChangeRequestStage = "PROPOSED" | "REVIEWED" | "APPROVED" | "DEPLOYED" | "VERIFIED" | "REJECTED";

export interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  authorId: string;
  stage: ChangeRequestStage;
  targetScope: string;
  changes: Record<string, unknown>;
  reviewerId?: string;
  approvalNotes?: string;
  proposedAt: string;
  approvedAt?: string;
  deployedAt?: string;
  verifiedAt?: string;
}

export class ChangeRequestWorkflow {
  static propose(
    title: string,
    description: string,
    authorId: string,
    targetScope: string,
    changes: Record<string, unknown>,
  ): ChangeRequest {
    return {
      id: `cr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title,
      description,
      authorId,
      stage: "PROPOSED",
      targetScope,
      changes,
      proposedAt: new Date().toISOString(),
    };
  }

  static review(cr: ChangeRequest, reviewerId: string): void {
    if (cr.stage !== "PROPOSED") throw new Error(`Cannot review ChangeRequest at stage [${cr.stage}]`);
    cr.reviewerId = reviewerId;
    cr.stage = "REVIEWED";
  }

  static approve(cr: ChangeRequest, reviewerId: string, notes?: string): void {
    if (cr.stage !== "REVIEWED") throw new Error(`Cannot approve ChangeRequest at stage [${cr.stage}]. Must be reviewed first.`);
    cr.reviewerId = reviewerId;
    cr.stage = "APPROVED";
    cr.approvedAt = new Date().toISOString();
    if (notes) cr.approvalNotes = notes;
  }

  static deploy(cr: ChangeRequest): void {
    if (cr.stage !== "APPROVED") throw new Error(`Cannot deploy ChangeRequest at stage [${cr.stage}]. Must be approved first.`);
    cr.stage = "DEPLOYED";
    cr.deployedAt = new Date().toISOString();
  }

  static verify(cr: ChangeRequest): void {
    if (cr.stage !== "DEPLOYED") throw new Error(`Cannot verify ChangeRequest at stage [${cr.stage}]. Must be deployed first.`);
    cr.stage = "VERIFIED";
    cr.verifiedAt = new Date().toISOString();
  }
}
