/**
 * @mosaix/ports-identity-store — Identity store port for MosaiX authentication.
 */

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

export interface IdentityStore {
  findById(id: string): Promise<Identity | null>;
  findByExternalIdentity(
    provider: string,
    externalId: string,
  ): Promise<Identity | null>;
  findByEmail(email: string): Promise<Identity | null>;
  create(identity: Identity): Promise<void>;
  update(identity: Identity): Promise<void>;
  linkExternalIdentity(
    input: LinkExternalIdentityInput,
  ): Promise<ExternalIdentity>;
  unlinkExternalIdentity(
    identityId: string,
    provider: string,
    externalId: string,
  ): Promise<void>;
}
