/**
 * @apps/citadelle — Canonical Application Entry Point
 * See: .project/architecture/canonical-app-schema.md
 */

import { Container, Router, createBoundedAppBootstrap } from "@mosaix/sdk";
import { MosaixApp, RuntimeKernel, type TenantIdentity } from "@mosaix/sdk";
import type { ApplicationManifest } from "@mosaix/contracts";
import { AuthManager } from "@mosaix/auth";
import { LocalPasswordProvider } from "@mosaix/adapter-auth-local";
import { UuidGeneratorAdapter } from "@mosaix/adapter-id-uuid";
import type { SecretsPort } from "@mosaix/ports-secrets";
import { InMemoryGuard } from "@mosaix/support";

import { IdentityController } from "./infrastructure/identity-controller.js";
import { UserService } from "./domain/user-service.js";
import { InMemoryUserRepository } from "./infrastructure/in-memory-user-repository.js";
import { InMemorySecretsAdapter } from "./infrastructure/in-memory-secrets-adapter.js";
import {
  InMemorySocialAccountRepository,
  type SocialAccountRepository,
} from "./infrastructure/social-account-repository.js";
import { RegistrationWizardService } from "./domain/registration-wizard.service.js";
import {
  identityEventPayloadSchemas,
  identityUserCreatedEvent,
  identityUserUpdatedEvent,
} from "./events/identity-events.js";

export const MANIFEST = {
  type: "application",
  id: "@apps/citadelle",
  name: "Citadelle",
  version: "1.0.0",
  domain: { name: "citadelle" },
  runtime: { entrypoint: "./src/index.ts", isolation: "trusted" },
  database: { strategy: "per-app" },
  capabilities: [
    { id: "citadelle.user.create", version: "1.0.0" },
    { id: "citadelle.user.lookup", version: "1.0.0" },
  ],
  permissions: [
    "citadelle:user:create:tenant",
    "citadelle:user:read:tenant",
  ],
  events: [
    "citadelle.user.created",
    "citadelle.user.updated",
  ],
  experience: {
    frontend: { entrypoint: "./frontend/src/index.ts" },
  },
} as const;

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
import { PostgresSessionStoreAdapter } from "@mosaix/adapter-session-store-postgres";

const defaultAdapters = {
  // Pas de UserRepository Postgres : le mapping canonique modèle `User` vs
  // `identities` du shell appartient à la vague citadelle (backlog
  // DB-BAC-OWNERSHIP) et aucun adapter n'existe dans `packages/` (interdit
  // d'en créer ici). Reste InMemory par conception, pas par oubli.
  // eslint-disable-next-line no-restricted-syntax -- couche 2 : aucun adapter persistant pour User/social/secrets/wizard ; exiger une DB ici supprimerait la feature.
  userRepository: () => new InMemoryUserRepository(),
};

export type CitadelleAdapters = Partial<typeof defaultAdapters> & {
  databasePort?: DatabasePort;
  /** Override session/token/credential stores (e.g. Redis/Postgres adapters in production). */
  sessionStore?: SessionStore;
  tokenStore?: TokenStore;
  credentialStore?: CredentialStore;
  /** Override identity store directly (takes precedence over databasePort). */
  identityStore?: IdentityStore;
  /** Override social-account repository (defaults to in-memory; no Postgres adapter exists yet — backlog). */
  socialAccountRepository?: SocialAccountRepository;
  /** Override registration wizard (defaults to a fresh in-memory instance — wizard persistant = backlog). */
  registrationWizard?: RegistrationWizardService;
  /** Override secrets adapter (defaults to in-memory with fallback guard). */
  secretsAdapter?: SecretsPort;
};

export class CitadelleServiceProvider {
  constructor(private readonly adapters: CitadelleAdapters = {}) {}

  register(container: Container): void {
    const userRepository = (this.adapters.userRepository ?? defaultAdapters.userRepository)();
    const userService = new UserService(userRepository);

    const dbPort = this.adapters.databasePort;
    const useDatabase = !!dbPort;
    const isSqlite = useDatabase && dbPort!.capabilities.dialect === "sqlite";

    // Pas de stockage en memoire hors tests : chaque store possede un adapter
    // persistant (SQLite + Postgres), donc l'absence de DatabasePort sans
    // override explicite est une erreur de composition, pas un fallback.
    for (const [storeName, store] of Object.entries({
      identityStore: this.adapters.identityStore,
      sessionStore: this.adapters.sessionStore,
      tokenStore: this.adapters.tokenStore,
      credentialStore: this.adapters.credentialStore,
    })) {
      if (!useDatabase && !store) {
        throw new Error(
          `[CitadelleAdapters] DatabasePort requis : passez databasePort ou ${storeName} (tests uniquement).`,
        );
      }
    }

    // Postgres : l'auth repose sur les tables shell-owned (`shell.core.v1.001`
    // → `identities`/`credentials`/`tokens` non préfixées) lues par les
    // adapters partagés `@mosaix/adapter-*-postgres`. Les tables `citadelle_*`
    // du provider restent des tables réservées non branchées en attendant
    // DB-BAC-OWNERSHIP (voir `infrastructure/migrations.ts`).
    const identityStore =
      this.adapters.identityStore ??
      (isSqlite
        ? new SQLiteIdentityStoreAdapter(dbPort!)
        : new PostgresIdentityStoreAdapter(dbPort!));

    // Sessions : SQLite et Postgres ont un adapter dedie ; sans DatabasePort
    // ni store explicite, echec franc (aucune session volatile silencieuse).
    let sessionStore: SessionStore;
    if (this.adapters.sessionStore) {
      sessionStore = this.adapters.sessionStore;
    } else if (useDatabase && isSqlite) {
      sessionStore = new SQLiteSessionStoreAdapter(dbPort!);
    } else if (useDatabase) {
      sessionStore = new PostgresSessionStoreAdapter(dbPort!);
    } else {
      throw new Error(
        "[CitadelleAdapters] DatabasePort requis : passez databasePort ou sessionStore (tests uniquement).",
      );
    }

    const tokenStore =
      this.adapters.tokenStore ??
      (isSqlite
        ? new SQLiteTokenStoreAdapter(dbPort!)
        : new PostgresTokenStoreAdapter(dbPort!));

    const credentialStore =
      this.adapters.credentialStore ??
      (isSqlite
        ? new SQLiteCredentialStoreAdapter(dbPort!)
        : new PostgresCredentialStoreAdapter(dbPort!));

    const idGenerator = new UuidGeneratorAdapter();
    // eslint-disable-next-line no-restricted-syntax -- couche 2 : EnvSecretsAdapter existe mais exige un cablage env ; en attendant, secrets en memoire explicites (jamais en prod via InMemoryGuard des chemins critiques).
    const secretsAdapter =
      this.adapters.secretsAdapter ??
      (() => {
        InMemoryGuard.reportFallback("InMemorySecretsAdapter", "no secretsAdapter option provided");
        return new InMemorySecretsAdapter();
      })();

    const authManager = new AuthManager(
      new Map(),
      identityStore,
      sessionStore,
      credentialStore,
      tokenStore,
      idGenerator,
    );

    authManager.registerProvider(
      new LocalPasswordProvider({
        credentialStore,
        identityStore,
        secrets: secretsAdapter,
        sessionCreation: authManager,
      }),
    );

    const controller = new IdentityController(authManager, userService);

    // Wizard + comptes sociaux : branchés en in-memory (alignable sans
    // nouveau package). Versions persistantes (table `social_accounts`,
    // wizard persistant, OAuth stocké) = backlog vague citadelle.
    const socialAccountRepository =
      this.adapters.socialAccountRepository ??
      // eslint-disable-next-line no-restricted-syntax -- couche 2 : aucun adapter persistant ; exiger une DB ici supprimerait la feature.
      new InMemorySocialAccountRepository();
    const registrationWizard =
      this.adapters.registrationWizard ?? new RegistrationWizardService();

    container.instance("userRepository", userRepository);
    container.instance("userService", userService);
    container.instance("socialAccountRepository", socialAccountRepository);
    container.instance("registrationWizard", registrationWizard);
    container.instance("authManager", authManager);
    container.instance(IdentityController, controller);
  }

  async boot(container: Container, router: Router): Promise<MosaixApp> {
    const controller = container.resolve<IdentityController>(IdentityController);

    router.post("/login", (req) => controller.handleLogin(req));
    router.post("/register", (req) => controller.handleRegister(req));
    router.post("/logout", (req) => controller.handleLogout(req));
    router.post("/refresh", (req) => controller.handleRefresh(req));
    router.get("/profile", (req) => controller.getProfile(req));

    const kernel = container.resolve<RuntimeKernel>("kernel");
    const tenant = container.resolve<TenantIdentity>("tenant");
    const app = MosaixApp.register(
      { manifest: MANIFEST as unknown as ApplicationManifest, tenant },
      kernel
    );

    const userService = container.resolve<UserService>("userService");
    app.provideCapability("citadelle.user.create", async (input) => {
      return userService.create(input as Parameters<typeof userService.create>[0]);
    });
    app.provideCapability("citadelle.user.lookup", async (input) => {
      const inp = input as { id?: string; email?: string };
      return userService.lookup(inp);
    });

    app.registerEventSchema({
      type: identityUserCreatedEvent,
      version: "1.0.0",
      schema: identityEventPayloadSchemas[identityUserCreatedEvent] as unknown as Record<string, unknown>,
    });
    app.registerEventSchema({
      type: identityUserUpdatedEvent,
      version: "1.0.0",
      schema: identityEventPayloadSchemas[identityUserUpdatedEvent] as unknown as Record<string, unknown>,
    });

    return app;
  }
}

export async function createCitadelleApp(
  kernel: RuntimeKernel,
  tenant: TenantIdentity,
  adapters?: CitadelleAdapters
): Promise<{ container: Container; router: Router; app: MosaixApp }> {
  return createBoundedAppBootstrap({
    manifest: MANIFEST as unknown as ApplicationManifest,
    tenant,
    kernel,
    provider: new CitadelleServiceProvider(adapters),
  });
}

export function createCitadelleComposition(parentContainer?: Container) {
  const container = parentContainer ? parentContainer.createChild() : new Container();
  // Unwired composition: controller without AuthManager/UserService fails closed
  // (503) instead of issuing mock tokens. Prefer createCitadelleApp() in production.
  const controller = new IdentityController();
  container.instance(IdentityController, controller);

  const router = new Router();
  router.post("/login", (req) => controller.handleLogin(req));
  router.post("/register", (req) => controller.handleRegister(req));
  router.post("/logout", (req) => controller.handleLogout(req));
  router.post("/refresh", (req) => controller.handleRefresh(req));
  router.get("/profile/:id", (req) => controller.getProfile(req));

  return { container, router, controller };
}

export * from "./domain/user.model.js";
export * from "./domain/user.js";
export * from "./domain/user-service.js";
export * from "./domain/password-hasher.port.js";
export * from "./domain/session-tokens.js";
export * from "./domain/citadelle-oauth-providers.js";
export * from "./domain/registration-wizard.service.js";


