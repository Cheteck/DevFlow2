/**
 * @mosaix/auth — Microsoft Entra / Microsoft Account OAuth 2.0 & OIDC Provider
 */

import { SocialAuthProvider } from "../social-auth-provider.js";
import type {
  SocialProviderConfig,
  OAuthAuthorizationUrlOptions,
  OAuthTokenResponse,
  SocialUserProfile,
} from "../oauth-types.js";

export class MicrosoftProvider extends SocialAuthProvider {
  readonly id = "microsoft" as const;
  readonly displayName = "Microsoft";
  readonly icon = `<svg class="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#FFB900" d="M13 13h10v10H13z"/></svg>`;
  readonly defaultScopes = ["openid", "profile", "email", "User.Read"];

  private readonly tenant: string;

  constructor(config: SocialProviderConfig) {
    super(config);
    this.tenant = config.tenant || "common";
  }

  private get authEndpoint(): string {
    return `https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/authorize`;
  }

  private get tokenEndpoint(): string {
    return `https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/token`;
  }

  private readonly graphMeEndpoint = "https://graph.microsoft.com/v1.0/me";

  getAuthorizationUrl(options: OAuthAuthorizationUrlOptions): string {
    const scopes = options.scopes || this.config.scopes || this.defaultScopes;
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: options.redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      state: options.state,
      response_mode: "query",
      prompt: options.prompt || "select_account",
    });

    if (options.codeChallenge) {
      params.set("code_challenge", options.codeChallenge);
      params.set("code_challenge_method", options.codeChallengeMethod || "S256");
    }

    if (options.loginHint) {
      params.set("login_hint", options.loginHint);
    }

    return `${this.authEndpoint}?${params.toString()}`;
  }

  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<OAuthTokenResponse> {
    const bodyParams = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret || "",
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    if (codeVerifier) {
      bodyParams.set("code_verifier", codeVerifier);
    }

    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Microsoft token exchange failed (${response.status}): ${errorText}`);
    }

    const data = await response.json() as Record<string, unknown>;
    return {
      accessToken: String(data.access_token || ""),
      tokenType: data.token_type ? String(data.token_type) : undefined,
      expiresIn: typeof data.expires_in === "number" ? data.expires_in : undefined,
      refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
      idToken: data.id_token ? String(data.id_token) : undefined,
      scope: data.scope ? String(data.scope) : undefined,
      raw: data,
    };
  }

  async getUserProfile(tokenResponse: OAuthTokenResponse): Promise<SocialUserProfile> {
    const response = await fetch(this.graphMeEndpoint, {
      headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
    });

    if (!response.ok) {
      if (tokenResponse.idToken) {
        return this.parseIdToken(tokenResponse.idToken);
      }
      throw new Error(`Microsoft Graph me failed with status ${response.status}`);
    }

    const data = await response.json() as Record<string, unknown>;
    const email = (data.mail || data.userPrincipalName) ? String(data.mail || data.userPrincipalName) : undefined;

    return {
      provider: this.id,
      providerUserId: String(data.id || ""),
      email,
      emailVerified: Boolean(email),
      firstName: data.givenName ? String(data.givenName) : undefined,
      lastName: data.surname ? String(data.surname) : undefined,
      displayName: data.displayName ? String(data.displayName) : undefined,
      rawProfile: data,
    };
  }

  private parseIdToken(idToken: string): SocialUserProfile {
    const parts = idToken.split(".");
    if (parts.length < 2) {
      throw new Error("Invalid Microsoft ID token format");
    }
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
    const email = (payload.email || payload.preferred_username) ? String(payload.email || payload.preferred_username) : undefined;
    return {
      provider: this.id,
      providerUserId: String(payload.sub || payload.oid || ""),
      email,
      emailVerified: Boolean(email),
      firstName: payload.given_name ? String(payload.given_name) : undefined,
      lastName: payload.family_name ? String(payload.family_name) : undefined,
      displayName: payload.name ? String(payload.name) : undefined,
      rawProfile: payload,
    };
  }
}
