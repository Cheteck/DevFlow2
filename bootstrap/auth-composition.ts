/**
 * @mosaix/bootstrap — Platform Auth & Identity Shared Composition Root
 * Centralizes single platform session authority and identity ports according to ADR-0012 and ADR-0017.
 */

import { AuthManager, SessionManager, PlatformSessionResolver } from "@mosaix/auth";
import { LocalPasswordProvider } from "@mosaix/adapter-auth-local";
import { UuidGeneratorAdapter } from "@mosaix/adapter-id-uuid";
import type { DatabasePort } from "@mosaix/ports-database";
import type { SessionStore } from "@mosaix/ports-session-store";
import type { TokenStore } from "@mosaix/ports-token-store";
import type { CredentialStore } from "@mosaix/ports-credential-store";
import type { IdentityStore } from "@mosaix/ports-identity-store";

import { PostgresIdentityStoreAdapter } from "@mosaix/adapter-identity-store-postgres";
import { PostgresCredentialStoreAdapter } from "@mosaix/adapter-credential-store-postgres";
import { PostgresTokenStoreAdapter } from "@mosaix/adapter-token-store-postgres";
import { SQLiteIdentityStoreAdapter } from "@mosaix/adapter-identity-store-sqlite";
import { SQLiteCredentialStoreAdapter } from "@mosaix/adapter-credential-store-sqlite";
import { SQLiteTokenStoreAdapter } from "@mosaix/adapter-token-store-sqlite";
import { SQLiteSessionStoreAdapter } from "@mosaix/adapter-session-store-sqlite";

import { InMemoryIdentityStore } from "../apps/citadelle/src/infrastructure/in-memory-identity-store.js";
import { InMemorySessionStore } from "../apps/citadelle/src/infrastructure/in-memory-session-store.js";
import { InMemoryTokenStore } from "../apps/citadelle/src/infrastructure/in-memory-token-store.js";
import { InMemoryCredentialStore } from "../apps/citadelle/src/infrastructure/in-memory-credential-store.js";
import { InMemorySecretsAdapter } from "../apps/citadelle/src/infrastructure/in-memory-secrets-adapter.js";
import { InMemoryGuard } from "@mosaix/support";

export interface PlatformAuthComposition {
  authManager: AuthManager;
  sessionManager: SessionManager;
  sessionResolver: PlatformSessionResolver;
  identityStore: IdentityStore;
  sessionStore: SessionStore;
  credentialStore: CredentialStore;
  tokenStore: TokenStore;
}

export function createPlatformAuthComposition(dbPort?: DatabasePort): PlatformAuthComposition {
  const useDatabase = Boolean(dbPort);
  const isSqlite = useDatabase && dbPort!.capabilities.dialect === "sqlite";

  if (!useDatabase) {
    InMemoryGuard.reportFallback("PlatformAuthComposition", "missing persistent DatabasePort");
  }

  const identityStore: IdentityStore = useDatabase
    ? (isSqlite
      ? new SQLiteIdentityStoreAdapter(dbPort!)
      : new PostgresIdentityStoreAdapter(dbPort!))
    : new InMemoryIdentityStore();

  const sessionStore: SessionStore = useDatabase && isSqlite
    ? new SQLiteSessionStoreAdapter(dbPort!)
    : new InMemorySessionStore();

  const tokenStore: TokenStore = useDatabase
    ? (isSqlite
      ? new SQLiteTokenStoreAdapter(dbPort!)
      : new PostgresTokenStoreAdapter(dbPort!))
    : new InMemoryTokenStore();

  const credentialStore: CredentialStore = useDatabase
    ? (isSqlite
      ? new SQLiteCredentialStoreAdapter(dbPort!)
      : new PostgresCredentialStoreAdapter(dbPort!))
    : new InMemoryCredentialStore();

  const idGenerator = new UuidGeneratorAdapter();
  const secretsAdapter = new InMemorySecretsAdapter();

  const sessionManager = new SessionManager(sessionStore, idGenerator);

  const authManager = new AuthManager(
    new Map(),
    identityStore,
    sessionStore,
    credentialStore,
    tokenStore,
    idGenerator,
  );

  const localPasswordProvider = new LocalPasswordProvider({
    credentialStore,
    identityStore,
    secrets: secretsAdapter,
    sessionCreation: authManager,
  });

  authManager.registerProvider(localPasswordProvider);

  const sessionResolver = new PlatformSessionResolver(sessionStore, identityStore);

  return {
    authManager,
    sessionManager,
    sessionResolver,
    identityStore,
    sessionStore,
    credentialStore,
    tokenStore,
  };
}
