export type ProposalStatus =
  | "Draft"
  | "Submitted"
  | "InReview"
  | "ChangesRequested"
  | "Approved"
  | "Rejected"
  | "Withdrawn"
  | "Archived";

export interface ProposalAuditEntry {
  at: string;
  by: string;
  action: string;
  detail?: string;
}

export interface Proposal {
  id: string;
  spaceId: string;
  proposerUserId: string;
  suggestedReference: string;
  type: "Product" | "Service" | "DigitalProduct" | "Experience";
  status: ProposalStatus;
  content: Record<string, unknown>;
  classification: Record<string, unknown>;
  characteristics: Record<string, unknown>;
  features: Record<string, unknown>;
  variants: Record<string, unknown>;
  media: Record<string, unknown>;
  translations: Record<string, unknown>;
  platformFeedback?: string | null;
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewStartedAt?: string | null;
  vendableId?: string | null;
  /** Commercial terms frozen at approval (SELL-FLOW-01); source for offer provisioning. */
  approvedTerms?: Record<string, unknown> | null;
  /** Offer provisioned at approval (null when no provisioning port or no terms). */
  approvedOfferId?: string | null;
  /** Approval idempotence key: replaying approve() with the same key never duplicates. */
  idempotencyKey?: string | null;
  /** Append-only lifecycle trail (created/submitted/review/decision). */
  auditTrail: ProposalAuditEntry[];
  submittedAt?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/* AUDIT-RESET a055b8e (2026-10-13) — PERTE CONFIRMÉE PUIS RESTAURÉE (V1.2, voir git log).
 * approvedTerms/auditTrail/idempotence manquaient (seul offerId de 0022dd6 survivait) ; restaurés
 * ci-dessus + persistance approve() + migration colonnes + tests. */
