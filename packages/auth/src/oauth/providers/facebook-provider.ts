/**
 * @mosaix/auth — Facebook OAuth 2.0 Provider
 */

import { SocialAuthProvider } from "../social-auth-provider.js";
import type {
  SocialProviderConfig,
  OAuthAuthorizationUrlOptions,
  OAuthTokenResponse,
  SocialUserProfile,
} from "../oauth-types.js";

export class FacebookProvider extends SocialAuthProvider {
  readonly id = "facebook" as const;
  readonly displayName = "Facebook";
  readonly icon = `<svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`;
  readonly defaultScopes = ["email", "public_profile"];

  private readonly authEndpoint = "https://www.facebook.com/v19.0/dialog/oauth";
  private readonly tokenEndpoint = "https://graph.facebook.com/v19.0/oauth/access_token";
  private readonly userEndpoint = "https://graph.facebook.com/me";

  constructor(config: SocialProviderConfig) {
    super(config);
  }

  getAuthorizationUrl(options: OAuthAuthorizationUrlOptions): string {
    const scopes = options.scopes || this.config.scopes || this.defaultScopes;
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: options.redirectUri,
      response_type: "code",
      scope: scopes.join(","),
      state: options.state,
    });

    return `${this.authEndpoint}?${params.toString()}`;
  }

  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    _codeVerifier?: string
  ): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret || "",
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(`${this.tokenEndpoint}?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Facebook token exchange failed (${response.status}): ${errorText}`);
    }

    const data = await response.json() as Record<string, unknown>;
    if (data.error) {
      const errObj = data.error as { message?: string };
      throw new Error(`Facebook OAuth error: ${errObj.message || JSON.stringify(data.error)}`);
    }

    return {
      accessToken: String(data.access_token || ""),
      tokenType: data.token_type ? String(data.token_type) : undefined,
      expiresIn: typeof data.expires_in === "number" ? data.expires_in : undefined,
      raw: data,
    };
  }

  async getUserProfile(tokenResponse: OAuthTokenResponse): Promise<SocialUserProfile> {
    const params = new URLSearchParams({
      access_token: tokenResponse.accessToken,
      fields: "id,name,first_name,last_name,email,picture.type(large)",
    });

    const response = await fetch(`${this.userEndpoint}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Facebook user fetch failed with status ${response.status}`);
    }

    const data = await response.json() as {
      id?: string;
      name?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      picture?: { data?: { url?: string } };
      [key: string]: unknown;
    };

    return {
      provider: this.id,
      providerUserId: String(data.id || ""),
      email: data.email,
      emailVerified: Boolean(data.email),
      firstName: data.first_name,
      lastName: data.last_name,
      displayName: data.name,
      avatarUrl: data.picture?.data?.url,
      rawProfile: data,
    };
  }
}
