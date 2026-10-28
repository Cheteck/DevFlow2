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
import type { TokenStore } from "@mosaix/ports-token-store";
import type { IdGeneratorPort } from "@mosaix/ports-id";
import type { AuthenticationProvider } from "@mosaix/contracts";
import { InMemoryGuard } from "@mosaix/support";
import * as crypto from "node:crypto";

export interface AuthCompositionContainer {
  /**
   * Null outside a fully-wired composition: the Shell owns no authentication
   * providers and no identity/credential/token stores, so no working
   * AuthManager can be assembled here (AUTH-E2E — login belongs to Citadelle).
   * Session paths (SessionManager) stay available. Callers must handle null
   * with an honest 503, never a fabricated 401.
   */
  readonly authManager: AuthManager | null;
  readonly sessionManager: SessionManager;
  readonly sessionStore: SessionStore;
}

export interface SharedAuthOptions {
  sessionStore?: SessionStore;
  identityStore?: IdentityStore;
  credentialStore?: CredentialStore;
  tokenStore?: TokenStore;
  providers?: Map<string, AuthenticationProvider>;
}

class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, Session>();

  constructor() {
    InMemoryGuard.reportFallback("InMemorySessionStore", "no sessionStore option provided in auth-composition");
  }

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

class DefaultIdGenerator implements IdGeneratorPort {
  generate(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  randomBytes(length: number): Buffer {
    return crypto.randomBytes(length);
  }
}

/**
 * Fail-closed store used when no persistent session store is configured and
 * the InMemoryGuard forbids the in-memory fallback (production or demo-off).
 * Reads resolve to "no session" (anonymous), writes are rejected — never a
 * fabricated session, and never a 500 from the composition root.
 */
const DisabledSessionStore: SessionStore = {
  create: async () => {
    throw new Error(
      "Session store disabled: no persistent session store configured.",
    );
  },
  get: async () => null,
  revoke: async () => {
    /* no-op: nothing to revoke in a disabled store */
  },
  revokeAllForIdentity: async () => {
    /* no-op */
  },
  listActiveForIdentity: async () => [],
};

function resolveSessionStore(options?: SharedAuthOptions): SessionStore {
  if (options?.sessionStore) return options.sessionStore;
  try {
    return new InMemorySessionStore();
  } catch (_err) {
    // Production/demo-off without a persistent store: fail closed.
    return DisabledSessionStore;
  }
}

let sharedAuthContainer: AuthCompositionContainer | null = null;

export function getSharedAuthComposition(
  options?: SharedAuthOptions,
): AuthCompositionContainer {
  if (sharedAuthContainer) {
    return sharedAuthContainer;
  }

  // eslint-disable-next-line no-restricted-syntax -- couche 2 : SSR/logout exigent un store fonctionnel sans DB disponible ici ; brancher un vrai store (couche 2) avant de durcir en fail-fast.
  const sessionStore = resolveSessionStore(options);
  const idGenerator = new DefaultIdGenerator();
  const sessionManager = new SessionManager(sessionStore, idGenerator);
  const identityStore = options?.identityStore;
  const credentialStore = options?.credentialStore;
  const tokenStore = options?.tokenStore;
  const authManager =
    identityStore !== undefined &&
    credentialStore !== undefined &&
    tokenStore !== undefined
      ? new AuthManager(
          options?.providers ?? new Map(),
          identityStore,
          sessionStore,
          credentialStore,
          tokenStore,
          idGenerator,
        )
      : null;

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
