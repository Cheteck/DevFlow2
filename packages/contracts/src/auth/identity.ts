export interface ExternalIdentity {
  provider: string;
  externalId: string;
  linkedAt: string;
  attributes?: Record<string, unknown>;
}

export interface Identity {
  id: string;
  tenantId: string;
  email?: string;
  displayName?: string;
  status: "active" | "disabled" | "pending";
  createdAt: string;
  updatedAt: string;
  externalIdentities: ExternalIdentity[];
  attributes: Record<string, unknown>;
}

export interface LinkExternalIdentityInput {
  identityId: string;
  provider: string;
  externalId: string;
  attributes?: Record<string, unknown>;
}
