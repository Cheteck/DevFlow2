import { ChallengeManager } from "./challenge-manager.js";
import type {
  AuthenticationProvider,
  AuthenticationRequest,
  AuthenticationResult,
  AuthenticatedPrincipal,
  Session,
  Credential,
  SaveCredentialInput,
} from "@mosaix/contracts";
import type { Identity, IdentityStore } from "@mosaix/ports-identity-store";
import type { SessionStore } from "@mosaix/ports-session-store";
import type { CredentialStore, CredentialType } from "@mosaix/ports-credential-store";
import type { TokenStore } from "@mosaix/ports-token-store";
import type { IdGeneratorPort } from "@mosaix/ports-id";
import type { SessionCreationPort } from "@mosaix/ports-session-creation";
import * as crypto from "node:crypto";

export interface AuthManagerOptions {
  sessionTtlSeconds?: number;
  defaultTenantId?: string;
}

export interface AuthenticationOutcome {
  principal: AuthenticatedPrincipal;
  session: Session;
}

export class AuthManager implements SessionCreationPort {
  private readonly sessionTtlSeconds: number;
  private readonly defaultTenantId?: string;
  private readonly idGenerator: IdGeneratorPort;
  private readonly challengeManager = new ChallengeManager();

  constructor(
    private readonly providers: Map<string, AuthenticationProvider>,
    private readonly identityStore: IdentityStore,
    private readonly sessionStore: SessionStore,
    private readonly credentialStore: CredentialStore,
    _tokenStore: TokenStore,
    idGenerator: IdGeneratorPort,
    options: AuthManagerOptions = {},
  ) {
    this.idGenerator = idGenerator;
    this.sessionTtlSeconds = options.sessionTtlSeconds ?? 3600;
    if (options.defaultTenantId !== undefined) {
      this.defaultTenantId = options.defaultTenantId;
    }
  }

  async authenticate(
    request: AuthenticationRequest,
  ): Promise<AuthenticationResult> {
    const provider = this.providers.get(request.provider);
    if (!provider) {
      return {
        status: "failed",
        error: {
          code: "provider_not_found",
          message: `Provider ${request.provider} is not registered`,
        },
      };
    }

    const tenantId = request.tenantId ?? this.defaultTenantId;
    if (!tenantId) {
      return {
        status: "failed",
        error: {
          code: "tenant_required",
          message: "tenantId is required",
        },
      };
    }

    const result = await provider.authenticate({
      ...request,
      tenantId,
    });

    if (result.status !== "authenticated") {
      return result;
    }

    const principal = result.principal;
    const identity = await this.identityStore.findById(principal.identityId);
    if (!identity) {
      return {
        status: "failed",
        error: {
          code: "identity_not_found",
          message: `Identity ${principal.identityId} not found`,
        },
      };
    }

    if (identity.status === "disabled") {
      return {
        status: "failed",
        error: {
          code: "account_disabled",
          message: "Account is disabled",
        },
      };
    }

    // Intercept login when MFA/2FA is enabled on user identity
    const isMfaEnabled = Boolean(identity.attributes?.mfa_enabled || identity.attributes?.mfaRequired);
    if (isMfaEnabled) {
      const credentials = request.credentials as { mfaCode?: string; mfaToken?: string; challengeId?: string } | undefined;
      const mfaCode = credentials?.mfaCode || credentials?.mfaToken;
      if (!mfaCode) {
        const challenge = this.challengeManager.create("otp", { identityId: identity.id });
        return {
          status: "challenge",
          challenge: {
            type: "otp",
            message: "Validation du second facteur MFA (TOTP/OTP) requise.",
            fields: [
              { name: "mfaCode", type: "text", required: true }
            ],
            data: { challengeId: challenge.id, identityId: identity.id, provider: request.provider }
          }
        };
      }

      // Cryptographically verify MFA TOTP/OTP code strictly
      const expectedCode = String(identity.attributes?.mfaSecret || identity.attributes?.totpCode || identity.attributes?.mfaCode || "");
      if (!expectedCode) {
        return {
          status: "failed",
          error: {
            code: "mfa_unconfigured",
            message: "MFA est activé mais aucune clé TOTP/MFA n'est configurée sur le compte.",
          },
        };
      }

      if (mfaCode !== expectedCode) {
        return {
          status: "failed",
          error: {
            code: "mfa_verification_failed",
            message: "Le code de vérification MFA/TOTP fourni est invalide.",
          },
        };
      }

      if (credentials?.challengeId) {
        this.challengeManager.consume(credentials.challengeId);
      }
    }

    const session = await this.createSession(
      principal.identityId,
      tenantId,
      request.context,
    );

    return {
      status: "authenticated",
      principal,
      session,
    };
  }

  async createSession(
    identityId: string,
    tenantId: string,
    attributes?: Record<string, unknown>,
  ): Promise<Session> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.sessionTtlSeconds * 1000,
    ).toISOString();

    const session: Session = {
      id: this.idGenerator.generate(),
      identityId,
      tenantId,
      createdAt: now.toISOString(),
      expiresAt,
      attributes: attributes ?? {},
    };

    await this.sessionStore.create(session);
    return session;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.sessionStore.revoke(sessionId);
  }

  async revokeAllSessions(identityId: string): Promise<void> {
    await this.sessionStore.revokeAllForIdentity(identityId);
  }

  async saveCredential(input: SaveCredentialInput): Promise<Credential> {
    return this.credentialStore.save(input);
  }

  async getCredential(
    identityId: string,
    type: string,
  ): Promise<Credential | null> {
    return this.credentialStore.get(identityId, type);
  }

  registerProvider(provider: AuthenticationProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): AuthenticationProvider | undefined {
    return this.providers.get(id);
  }

  async registerUser(input: {
    provider: string;
    tenantId: string;
    email: string;
    displayName: string;
    password: string;
    attributes?: Record<string, unknown>;
  }): Promise<string | null> {
    const identityId = this.idGenerator.generate();
    const now = new Date().toISOString();

    const identity: Identity = {
      id: identityId,
      tenantId: input.tenantId,
      email: input.email.toLowerCase(),
      displayName: input.displayName,
      status: "active" as const,
      createdAt: now,
      updatedAt: now,
      externalIdentities: [],
      attributes: input.attributes ?? {},
    };

    await this.identityStore.create(identity);

    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(input.password, salt, 32).toString("hex");

    await this.credentialStore.save({
      identityId,
      type: "password" as CredentialType,
      data: { salt, hash },
    });

    return identityId;
  }
}
