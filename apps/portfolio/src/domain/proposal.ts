export type ProposalStatus =
  | "Draft"
  | "Submitted"
  | "InReview"
  | "ChangesRequested"
  | "Approved"
  | "Rejected"
  | "Withdrawn"
  | "Archived";

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
  submittedAt?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/* AUDIT-RESET a055b8e (2026-10-13) — PERTE CONFIRMÉE (delta SELL-FLOW-01).
 * La session annonçait "Saga SELL-FLOW-01 complète avec offerId, approvedTerms, auditTrail, clé d'idempotence",
 * mais l'interface ci-dessus ne porte ni approvedTerms, ni auditTrail, ni clé d'idempotence (grep vide sur
 * tout apps/portfolio/src ; seul offerId survit via le commit antérieur 0022dd6). Fichier absent de a055b8e.
 * Restauration recommandée : réajouter les trois champs + persistance dans proposal-service.approve() +
 * tests d'approbation et d'échecs de provisionnement dans proposal.test.ts. */
