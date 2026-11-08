/**
 * @apps/citadelle — Canonical Application Entry Point
 */

import { Container, Router, createBoundedAppBootstrap } from "@mosaix/sdk";
import { MosaixApp, RuntimeKernel, type TenantIdentity } from "@mosaix/sdk";
import type { ApplicationManifest } from "@mosaix/contracts";
import { AuthManager } from "@mosaix/auth";
import { LocalPasswordProvider } from "@mosaix/adapter-auth-local";
import { UuidGeneratorAdapter } from "@mosaix/adapter-id-uuid";
import { InMemoryGuard } from "@mosaix/support";
import type { DatabasePort } from "@mosaix/ports-database";
import type { SessionStore } from "@mosaix/ports-session-store";
import type { TokenStore } from "@mosaix/ports-token-store";
import type { CredentialStore } from "@mosaix/ports-credential-store";
import type { IdentityStore } from "@mosaix/ports-identity-store";
import type { CryptoPort } from "@mosaix/ports-crypto";
import type { ClockPort } from "@mosaix/ports-clock";
import type { LoggingPort } from "@mosaix/ports-logging";
import type { SecretsPort } from "@mosaix/ports-secrets";

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
import { MfaService } from "./domain/mfa-service.js";
import { OtpService } from "../../../packages/otp/src/application/otp-service.ts";
import { MfaController } from "./infrastructure/mfa-controller.js";
import { createMfaGuardMiddleware, checkMfaGuard } from "./infrastructure/mfa-middleware.js";
import { InMemoryOtpRepository } from "./infrastructure/in-memory-otp-repository.js";
import { InMemoryOtpDelivery } from "./infrastructure/in-memory-otp-delivery.js";
import { InMemoryOtpRateLimiter } from "./infrastructure/in-memory-otp-rate-limiter.js";
import { ConsoleLoggerAdapter } from "./infrastructure/console-logger-adapter.js";

// --- Inline crypto adapter (Node.js crypto) ---
import { createHash, createHmac, createCipheriv, createDecipheriv, createSign, createVerify, randomBytes, timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";

class InlineCryptoAdapter implements CryptoPort {
  async hash(data: string | Buffer, algorithm: string = "sha256"): Promise<string> {
    const hash = createHash(algorithm);
    hash.update(data);
    return hash.digest("hex");
  }
  async hmac(data: string | Buffer, secret: string, algorithm: string = "sha256"): Promise<string> {
    const hmac = createHmac(algorithm, secret);
    hmac.update(data);
    return hmac.digest("base64url");
  }
  async encrypt(data: string | Buffer, key: Buffer): Promise<{ ciphertext: Buffer; iv: Buffer; tag?: Buffer }> {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const buffer = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
    const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { ciphertext, iv, tag };
  }
  async decrypt(ciphertext: Buffer, key: Buffer, iv: Buffer, tag?: Buffer): Promise<Buffer> {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    if (tag) decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
  async sign(data: string | Buffer, privateKey: string): Promise<Buffer> {
    const sign = createSign("SHA256");
    sign.update(data);
    return sign.sign(privateKey);
  }
  async verify(data: string | Buffer, signature: Buffer, publicKey: string): Promise<boolean> {
    const verify = createVerify("SHA256");
    verify.update(data);
    return verify.verify(publicKey, signature);
  }
  randomBytes(length: number): Buffer {
    return randomBytes(length);
  }
  async verifyPassword(password: string, expectedHash: string, _salt: string): Promise<boolean> {
    const hash = createHash("sha256").update(password).digest("hex");
    return hash === expectedHash;
  }
  timingSafeEqual(a: string | Buffer, b: string | Buffer): boolean {
    const bufA = typeof a === "string" ? Buffer.from(a, "utf-8") : a;
    const bufB = typeof b === "string" ? Buffer.from(b, "utf-8") : b;
    if (bufA.length !== bufB.length) return false;
    return cryptoTimingSafeEqual(bufA, bufB);
  }
}

// --- Inline clock adapter ---
class InlineClockAdapter implements ClockPort {
  now(): Date {
    return new Date();
  }
}

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
    { id: "citadelle.mfa.enroll", version: "1.0.0" },
    { id: "citadelle.mfa.verify", version: "1.0.0" },
    { id: "citadelle.mfa.disable", version: "1.0.0" },
    { id: "citadelle.mfa.recovery", version: "1.0.0" },
  ],
  permissions: [
    "citadelle:user:create:tenant",
    "citadelle:user:read:tenant",
    "citadelle:mfa:enroll",
    "citadelle:mfa:verify",
    "citadelle:mfa:disable",
  ],
  events: [
    "citadelle.user.created",
    "citadelle.user.updated",
  ],
  experience: {
    frontend: { entrypoint: "./frontend/src/index.ts" },
  },
} as const;

export type CitadelleAdapters = {
  databasePort?: DatabasePort;
  sessionStore?: SessionStore;
  tokenStore?: TokenStore;
  credentialStore?: CredentialStore;
  identityStore?: IdentityStore;
  socialAccountRepository?: SocialAccountRepository;
  registrationWizard?: RegistrationWizardService;
  secretsAdapter?: SecretsPort;
  crypto?: CryptoPort;
  clock?: ClockPort;
  logger?: LoggingPort;
};

export class CitadelleServiceProvider {
  constructor(private readonly adapters: CitadelleAdapters = {}) {}

  register(container: Container): void {
    const userRepository = new InMemoryUserRepository();
    const userService = new UserService(userRepository);

    const dbPort = this.adapters.databasePort;
    const useDatabase = !!dbPort;

    for (const [storeName, store] of Object.entries({
      identityStore: this.adapters.identityStore,
      sessionStore: this.adapters.sessionStore,
      tokenStore: this.adapters.tokenStore,
      credentialStore: this.adapters.credentialStore,
    })) {
      if (!store) {
        throw new Error(
          `[CitadelleAdapters] ${storeName} requis : passez databasePort ou ${storeName} (tests uniquement).`,
        );
      }
    }

    const identityStore = this.adapters.identityStore!;
    const sessionStore = this.adapters.sessionStore!;
    const tokenStore = this.adapters.tokenStore!;
    const credentialStore = this.adapters.credentialStore!;

    const idGenerator = new UuidGeneratorAdapter();
    const secretsAdapter =
      this.adapters.secretsAdapter ??
      (() => {
        InMemoryGuard.reportFallback("InMemorySecretsAdapter", "no secretsAdapter option provided");
        return new InMemorySecretsAdapter();
      })();

    const crypto = this.adapters.crypto ?? new InlineCryptoAdapter();
    const clock = this.adapters.clock ?? new InlineClockAdapter();
    const logger = this.adapters.logger ?? new ConsoleLoggerAdapter();

    const otpRepository = new InMemoryOtpRepository();
    const otpDelivery = new InMemoryOtpDelivery();
    const otpRateLimiter = new InMemoryOtpRateLimiter();
    const otpService = new OtpService(
      otpRepository,
      otpDelivery,
      otpRateLimiter,
      crypto,
      clock,
      idGenerator,
      secretsAdapter,
      logger,
      { get: (_key: string) => undefined, getOrDefault: (_key: string, d: string) => d, getRequired: (k: string) => { throw new Error(`Missing config: ${k}`); } },
    );

    const mfaService = new MfaService(
      otpService,
      userRepository,
      crypto,
      clock,
      secretsAdapter,
      logger,
    );

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

    const controller = new IdentityController(authManager, userService, mfaService);

    const socialAccountRepository =
      this.adapters.socialAccountRepository ??
      new InMemorySocialAccountRepository();
    const registrationWizard =
      this.adapters.registrationWizard ?? new RegistrationWizardService();

    container.instance("userRepository", userRepository);
    container.instance("userService", userService);
    container.instance("socialAccountRepository", socialAccountRepository);
    container.instance("registrationWizard", registrationWizard);
    container.instance("authManager", authManager);
    container.instance("otpService", otpService);
    container.instance("mfaService", mfaService);
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

    const mfaService = container.resolve<MfaService>("mfaService");
    const mfaController = new MfaController(mfaService, userService, tenant.tenantId ?? "default");

    router.get("/api/auth/mfa/status", (req) => mfaController.getStatus(req));
    router.post("/api/auth/mfa/enroll/totp", (req) => mfaController.enrollTotp(req));
    router.post("/api/auth/mfa/enroll/totp/verify", (req) => mfaController.completeEnrollment(req));
    router.post("/api/auth/mfa/verify", (req) => mfaController.verifyTotp(req));
    router.post("/api/auth/mfa/verify/recovery", (req) => mfaController.verifyRecovery(req));
    router.post("/api/auth/mfa/disable", (req) => mfaController.disableMfa(req));
    router.post("/api/auth/mfa/recovery/regenerate", (req) => mfaController.regenerateRecovery(req));

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
export * from "./domain/mfa-service.js";
export { MfaController } from "./infrastructure/mfa-controller.js";
export { checkMfaGuard, createMfaGuardMiddleware } from "./infrastructure/mfa-middleware.js";
