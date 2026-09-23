/**
 * @mosaix/ports-credential-store — Credential store port for MosaiX authentication.
 */

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

export interface CredentialStore {
  get(identityId: string, type: string): Promise<Credential | null>;
  save(input: SaveCredentialInput): Promise<Credential>;
  revoke(credentialId: string): Promise<void>;
  revokeAllForIdentity(identityId: string): Promise<void>;
}
