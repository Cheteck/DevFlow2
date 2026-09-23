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
