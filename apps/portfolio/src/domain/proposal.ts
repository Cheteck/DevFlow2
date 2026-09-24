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
