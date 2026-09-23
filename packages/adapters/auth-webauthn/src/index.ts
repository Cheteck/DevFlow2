import type {
  AuthenticationProvider,
  AuthenticationRequest,
  AuthenticationResult,
} from "@mosaix/contracts";
import type { IdentityStore } from "@mosaix/ports-identity-store";
import type { SessionStore } from "@mosaix/ports-session-store";
import type { SessionCreationPort } from "@mosaix/ports-session-creation";

export interface WebAuthnProviderOptions {
  id: string;
  rpId: string;
  rpName: string;
  origin: string;
  identityStore: IdentityStore;
  sessionStore: SessionStore;
  sessionCreation: SessionCreationPort;
}

export class WebAuthnProvider implements AuthenticationProvider {
  readonly id: string;
  readonly capabilities = ["webauthn", "passwordless"];

  private readonly rpId: string;
  private readonly rpName: string;
  private readonly origin: string;

  constructor(private readonly options: WebAuthnProviderOptions) {
    this.id = options.id;
    this.rpId = options.rpId;
    this.rpName = options.rpName;
    this.origin = options.origin;
  }

  async authenticate(
    request: AuthenticationRequest,
  ): Promise<AuthenticationResult> {
    const action = request.context?.action as string | undefined;

    if (action === "verify") {
      return this.verifyAssertion(request);
    }

    return {
      status: "challenge",
      challenge: {
        type: "webauthn",
        message: "Use your security key or biometric to authenticate",
        fields: [
          { name: "credentialId", type: "hidden", required: true },
          { name: "authenticatorData", type: "hidden", required: true },
          { name: "clientDataJSON", type: "hidden", required: true },
          { name: "signature", type: "hidden", required: true },
        ],
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        data: {
          rpId: this.rpId,
          rpName: this.rpName,
          origin: this.origin,
        },
      },
    };
  }

  private async verifyAssertion(
    request: AuthenticationRequest,
  ): Promise<AuthenticationResult> {
    const credentialId = request.credentials.credentialId as string | undefined;
    if (!credentialId) {
      return {
        status: "failed",
        error: {
          code: "missing_credential",
          message: "credentialId is required",
        },
      };
    }

    const identity = await this.options.identityStore.findByExternalIdentity(
      "webauthn",
      credentialId,
    );

    if (!identity) {
      return {
        status: "failed",
        error: { code: "identity_not_found", message: "Identity not found" },
      };
    }

    if (identity.status === "disabled") {
      return {
        status: "failed",
        error: { code: "account_disabled", message: "Account is disabled" },
      };
    }

    const principal = {
      subject: identity.id,
      tenantId: request.tenantId,
      identityId: identity.id,
      authentication: {
        provider: this.id,
        method: "webauthn" as const,
        authenticatedAt: new Date().toISOString(),
        assuranceLevel: "3",
      },
      attributes: {},
    };

    const session = await this.options.sessionCreation.createSession(
      identity.id,
      request.tenantId,
    );

    return {
      status: "authenticated",
      principal,
      session,
    };
  }
}
