export type CredentialType = "password" | "api-key" | "certificate" | "custom";

export interface Credential {
  id: string;
  identityId: string;
  type: CredentialType;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  data: Record<string, unknown>;
}

export interface SaveCredentialInput {
  identityId: string;
  type: CredentialType;
  data: Record<string, unknown>;
  expiresAt?: string;
}
