/**
 * @mosaix/auth — Google OAuth 2.0 & OpenID Connect Provider
 */

import { SocialAuthProvider } from "../social-auth-provider.js";
import type {
  SocialProviderConfig,
  OAuthAuthorizationUrlOptions,
  OAuthTokenResponse,
  SocialUserProfile,
} from "../oauth-types.js";

export class GoogleProvider extends SocialAuthProvider {
  readonly id = "google" as const;
  readonly displayName = "Google";
  readonly icon = `<svg class="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>`;
  readonly defaultScopes = ["openid", "profile", "email"];

  private readonly authEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
  private readonly tokenEndpoint = "https://oauth2.googleapis.com/token";
  private readonly userinfoEndpoint = "https://openidconnect.googleapis.com/v1/userinfo";

  constructor(config: SocialProviderConfig) {
    super(config);
  }

  getAuthorizationUrl(options: OAuthAuthorizationUrlOptions): string {
    const scopes = options.scopes || this.config.scopes || this.defaultScopes;
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: options.redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      state: options.state,
      access_type: "offline",
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
      throw new Error(`Google token exchange failed (${response.status}): ${errorText}`);
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
    // If ID token is present, we can also extract information, but userinfo gives fresh verified profile
    const response = await fetch(this.userinfoEndpoint, {
      headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
    });

    if (!response.ok) {
      // Fallback: decode ID token if userinfo fails
      if (tokenResponse.idToken) {
        return this.parseIdToken(tokenResponse.idToken);
      }
      throw new Error(`Google userinfo failed with status ${response.status}`);
    }

    const data = await response.json() as Record<string, unknown>;
    return {
      provider: this.id,
      providerUserId: String(data.sub || data.id || ""),
      email: data.email ? String(data.email) : undefined,
      emailVerified: data.email_verified === true || data.email_verified === "true",
      firstName: data.given_name ? String(data.given_name) : undefined,
      lastName: data.family_name ? String(data.family_name) : undefined,
      displayName: data.name ? String(data.name) : undefined,
      avatarUrl: data.picture ? String(data.picture) : undefined,
      rawProfile: data,
    };
  }

  private parseIdToken(idToken: string): SocialUserProfile {
    const parts = idToken.split(".");
    if (parts.length < 2) {
      throw new Error("Invalid ID token format");
    }
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
    return {
      provider: this.id,
      providerUserId: String(payload.sub || ""),
      email: payload.email ? String(payload.email) : undefined,
      emailVerified: payload.email_verified === true || payload.email_verified === "true",
      firstName: payload.given_name ? String(payload.given_name) : undefined,
      lastName: payload.family_name ? String(payload.family_name) : undefined,
      displayName: payload.name ? String(payload.name) : undefined,
      avatarUrl: payload.picture ? String(payload.picture) : undefined,
      rawProfile: payload,
    };
  }
}
