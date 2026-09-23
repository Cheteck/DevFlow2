/**
 * @mosaix/auth — Apple Sign In Provider (OAuth 2.0 / OpenID Connect)
 */

import { SocialAuthProvider } from "../social-auth-provider.js";
import type {
  SocialProviderConfig,
  OAuthAuthorizationUrlOptions,
  OAuthTokenResponse,
  SocialUserProfile,
} from "../oauth-types.js";

export class AppleProvider extends SocialAuthProvider {
  readonly id = "apple" as const;
  readonly displayName = "Apple";
  readonly icon = `<svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.99.6-2.61 1.34-.55.63-.99 1.66-.86 2.69 1.01.08 2.03-.52 2.55-1.18z"/></svg>`;
  readonly defaultScopes = ["name", "email"];

  private readonly authEndpoint = "https://appleid.apple.com/auth/authorize";
  private readonly tokenEndpoint = "https://appleid.apple.com/auth/token";

  constructor(config: SocialProviderConfig) {
    super(config);
  }

  getAuthorizationUrl(options: OAuthAuthorizationUrlOptions): string {
    const scopes = options.scopes || this.config.scopes || this.defaultScopes;
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: options.redirectUri,
      response_type: "code id_token",
      response_mode: "form_post",
      scope: scopes.join(" "),
      state: options.state,
    });

    return `${this.authEndpoint}?${params.toString()}`;
  }

  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    _codeVerifier?: string
  ): Promise<OAuthTokenResponse> {
    const bodyParams = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret || "",
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apple token exchange failed (${response.status}): ${errorText}`);
    }

    const data = await response.json() as Record<string, unknown>;
    return {
      accessToken: String(data.access_token || ""),
      tokenType: data.token_type ? String(data.token_type) : undefined,
      expiresIn: typeof data.expires_in === "number" ? data.expires_in : undefined,
      refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
      idToken: data.id_token ? String(data.id_token) : undefined,
      raw: data,
    };
  }

  async getUserProfile(tokenResponse: OAuthTokenResponse): Promise<SocialUserProfile> {
    if (!tokenResponse.idToken) {
      throw new Error("Apple Sign In requires an id_token to extract user identity");
    }

    const parts = tokenResponse.idToken.split(".");
    if (parts.length < 2) {
      throw new Error("Invalid Apple ID token format");
    }

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
    const email = payload.email ? String(payload.email) : undefined;
    const emailVerified = payload.email_verified === true || payload.email_verified === "true";

    return {
      provider: this.id,
      providerUserId: String(payload.sub || ""),
      email,
      emailVerified,
      displayName: email ? email.split("@")[0] : undefined,
      rawProfile: payload,
    };
  }
}
