import type { Session } from "@mosaix/contracts";
import type { SessionStore } from "@mosaix/ports-session-store";
import type { IdGeneratorPort } from "@mosaix/ports-id";

export interface SessionManagerOptions {
  defaultTtlSeconds?: number;
}

export class SessionManager {
  private readonly defaultTtlSeconds: number;
  private readonly idGenerator: IdGeneratorPort;

  constructor(
    private readonly sessionStore: SessionStore,
    idGenerator: IdGeneratorPort,
    options: SessionManagerOptions = {},
  ) {
    this.idGenerator = idGenerator;
    this.defaultTtlSeconds = options.defaultTtlSeconds ?? 3600;
  }

  async create(
    identityId: string,
    tenantId: string,
    applicationId?: string,
    attributes?: Record<string, unknown>,
  ): Promise<Session> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.defaultTtlSeconds * 1000,
    ).toISOString();

    const session: Session = {
      id: this.idGenerator.generate(),
      identityId,
      tenantId,
      createdAt: now.toISOString(),
      expiresAt,
      attributes: attributes ?? {},
      ...(applicationId !== undefined ? { applicationId } : {}),
    };

    await this.sessionStore.create(session);
    return session;
  }

  async get(id: string): Promise<Session | null> {
    return this.sessionStore.get(id);
  }

  async revoke(id: string): Promise<void> {
    await this.sessionStore.revoke(id);
  }

  async revokeAllForIdentity(identityId: string): Promise<void> {
    await this.sessionStore.revokeAllForIdentity(identityId);
  }

  async listActiveForIdentity(identityId: string): Promise<Session[]> {
    return this.sessionStore.listActiveForIdentity(identityId);
  }

  isExpired(session: Session): boolean {
    return new Date(session.expiresAt) < new Date();
  }

  isRevoked(session: Session): boolean {
    return session.revokedAt !== undefined;
  }
}
