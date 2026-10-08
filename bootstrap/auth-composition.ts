/**
 * bootstrap/auth-composition — Shared Auth Composition Root (AUTH-01 / ADR-0017).
 *
 * Centralizes the platform AuthManager and SessionStore instances in a single
 * assembler location shared between the Shell and Citadelle (apps/citadelle).
 *
 * Rule: Assembler only — no business logic.
 */

import { AuthManager, SessionManager } from "@mosaix/auth";
import type { SessionStore, Session } from "@mosaix/ports-session-store";
import type { IdentityStore } from "@mosaix/ports-identity-store";
import type { CredentialStore } from "@mosaix/ports-credential-store";

export interface AuthCompositionContainer {
  readonly authManager: AuthManager;
  readonly sessionManager: SessionManager;
  readonly sessionStore: SessionStore;
}

class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, Session>();

  async create(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async get(id: string): Promise<Session | null> {
    return this.sessions.get(id) || null;
  }

  async revoke(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  async revokeAllForIdentity(identityId: string): Promise<void> {
    for (const [id, s] of this.sessions.entries()) {
      if (s.identityId === identityId) {
        this.sessions.delete(id);
      }
    }
  }

  async listActiveForIdentity(identityId: string): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter((s) => s.identityId === identityId);
  }
}

class DefaultIdGenerator {
  generate(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

let sharedAuthContainer: AuthCompositionContainer | null = null;

export function getSharedAuthComposition(options?: {
  sessionStore?: SessionStore;
  identityStore?: IdentityStore;
  credentialStore?: CredentialStore;
}): AuthCompositionContainer {
  if (sharedAuthContainer) {
    return sharedAuthContainer;
  }

  const sessionStore = options?.sessionStore || new InMemorySessionStore();
  const idGenerator = new DefaultIdGenerator();
  const sessionManager = new SessionManager(sessionStore, idGenerator);
  const authManager = new AuthManager({
    sessionManager,
    identityStore: options?.identityStore,
    credentialStore: options?.credentialStore,
  });

  sharedAuthContainer = {
    authManager,
    sessionManager,
    sessionStore,
  };

  return sharedAuthContainer;
}

export function resetSharedAuthComposition(): void {
  sharedAuthContainer = null;
}
