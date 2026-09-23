import type {
  AuthenticationProvider,
  AuthenticationRequest,
  AuthenticationResult,
} from "@mosaix/contracts";
import type { IdentityStore } from "@mosaix/ports-identity-store";
import type { SessionStore } from "@mosaix/ports-session-store";
import type { SecretsPort } from "@mosaix/ports-secrets";
import type { SessionCreationPort } from "@mosaix/ports-session-creation";
import type { HttpPort } from "@mosaix/ports-http";

export interface OidcProviderOptions {
  id: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  redirectUri?: string;
  identityStore: IdentityStore;
  sessionStore: SessionStore;
  secrets: SecretsPort;
  sessionCreation: SessionCreationPort;
  http: HttpPort;
}

export class OidcProvider implements AuthenticationProvider {
  readonly id: string;
  readonly capabilities = ["oidc", "oauth2"];

  private readonly issuer: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly scopes: string[];
  private readonly redirectUri: string;

  constructor(private readonly options: OidcProviderOptions) {
    this.id = options.id;
    this.issuer = options.issuer;
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.scopes = options.scopes ?? ["openid", "profile", "email"];
    this.redirectUri = options.redirectUri ?? "/auth/callback";
  }

  async authenticate(
    request: AuthenticationRequest,
  ): Promise<AuthenticationResult> {
    if (request.context?.code) {
      return this.handleCallback(request);
    }

    const authUrl = new URL(`${this.issuer}/authorize`);
    authUrl.searchParams.set("client_id", this.clientId);
    authUrl.searchParams.set("redirect_uri", this.redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", this.scopes.join(" "));
    authUrl.searchParams.set("state", crypto.randomUUID());

    return {
      status: "redirect",
      redirect: {
        url: authUrl.toString(),
        method: "GET",
      },
    };
  }

  private async handleCallback(
    request: AuthenticationRequest,
  ): Promise<AuthenticationResult> {
    const code = request.context?.code as string | undefined;
    if (!code) {
      return {
        status: "failed",
        error: {
          code: "missing_code",
          message: "Authorization code is required",
        },
      };
    }

    const tokenResponse = await this.options.http.post(
      `${this.issuer}/token`,
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    if (tokenResponse.status !== 200) {
      return {
        status: "failed",
        error: {
          code: "token_error",
          message: "Failed to exchange code for token",
        },
      };
    }

    const tokenData = tokenResponse.json<{
      access_token: string;
      token_type: string;
    }>();
    const userInfo = await this.fetchUserInfo(tokenData.access_token as string);

    const identity = await this.options.identityStore.findByExternalIdentity(
      this.id,
      userInfo.sub as string,
    );

    if (!identity) {
      return {
        status: "failed",
        error: { code: "identity_not_linked", message: "Identity not linked" },
      };
    }

    const principal = {
      subject: identity.id,
      tenantId: request.tenantId,
      identityId: identity.id,
      authentication: {
        provider: this.id,
        method: "oidc" as const,
        authenticatedAt: new Date().toISOString(),
        assuranceLevel: "2",
      },
      attributes: userInfo,
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

  private async fetchUserInfo(
    accessToken: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.options.http.get(
      `${this.issuer}/userinfo`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (response.status !== 200) {
      throw new Error("Failed to fetch user info");
    }
    return response.json();
  }
}
