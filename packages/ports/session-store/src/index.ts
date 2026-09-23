/**
 * @mosaix/ports-session-store — Session store port for MosaiX authentication.
 */

export interface Session {
  id: string;
  identityId: string;
  tenantId: string;
  applicationId?: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  attributes: Record<string, unknown>;
}

export interface SessionStore {
  create(session: Session): Promise<void>;
  get(id: string): Promise<Session | null>;
  revoke(id: string): Promise<void>;
  revokeAllForIdentity(identityId: string): Promise<void>;
  listActiveForIdentity(identityId: string): Promise<Session[]>;
}
