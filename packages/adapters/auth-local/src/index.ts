import { scryptSync, timingSafeEqual } from "node:crypto";
import type {
  AuthenticationProvider,
  AuthenticationRequest,
  AuthenticationResult,
  AuthenticatedPrincipal,
} from "@mosaix/contracts";
import type { CredentialStore } from "@mosaix/ports-credential-store";
import type { CryptoPort } from "@mosaix/ports-crypto";
import type { IdentityStore } from "@mosaix/ports-identity-store";
import type { SecretsPort } from "@mosaix/ports-secrets";
import type { SessionCreationPort } from "@mosaix/ports-session-creation";

export interface LocalPasswordProviderOptions {
  credentialStore: CredentialStore;
  identityStore: IdentityStore;
  secrets: SecretsPort;
  sessionCreation: SessionCreationPort;
  crypto?: CryptoPort;
  pepperKey?: string;
}

export class LocalPasswordProvider implements AuthenticationProvider {
  readonly id = "local";
  readonly capabilities = ["password", "custom"];

  constructor(private readonly options: LocalPasswordProviderOptions) {}

  async authenticate(
    request: AuthenticationRequest,
  ): Promise<AuthenticationResult> {
    const email = (
      request.credentials.email as string | undefined
    )?.toLowerCase();
    const password = request.credentials.password as string | undefined;

    if (!email || !password) {
      return this.failed("invalid_request", "email and password are required");
    }

    const identity = await this.options.identityStore.findByEmail?.(email);
    if (!identity) {
      return this.failed("invalid_credentials", "Invalid email or password");
    }

    if (identity.status === "disabled") {
      return this.failed("account_disabled", "Account is disabled");
    }

    const credential = await this.options.credentialStore.get(
      identity.id,
      "password",
    );
    if (!credential) {
      return this.failed("no_password", "No password credential found");
    }

    const pepper = this.options.pepperKey
      ? await this.options.secrets.getRequiredSecret(this.options.pepperKey)
      : undefined;

    const isValid = await this.verifyPassword(
      password,
      credential.data as { salt: string; hash: string },
      pepper ?? "",
    );

    if (!isValid) {
      return this.failed("invalid_credentials", "Invalid email or password");
    }

    const principal: AuthenticatedPrincipal = {
      subject: identity.id,
      tenantId: request.tenantId,
      identityId: identity.id,
      authentication: {
        provider: this.id,
        method: "password",
        authenticatedAt: new Date().toISOString(),
        assuranceLevel: "1",
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

  private async verifyPassword(
    password: string,
    stored: { salt: string; hash: string },
    pepper?: string,
  ): Promise<boolean> {
    if (this.options.crypto?.verifyPassword) {
      return this.options.crypto.verifyPassword(
        password + (pepper ?? ""),
        stored.hash,
      );
    }

    const actual = scryptSync(password + (pepper ?? ""), stored.salt, 32);
    const expected = Buffer.from(stored.hash, "hex");
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  }

  private failed(code: string, message: string): AuthenticationResult {
    return {
      status: "failed",
      error: { code, message },
    };
  }
}
