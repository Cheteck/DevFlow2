export interface Session {
  id: string;
  identityId: string;
  tenantId: string;
  applicationId?: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  /** Optional extra claims — aligned with the `SessionStore` port. */
  attributes?: Record<string, unknown>;
}
