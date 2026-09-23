/**
 * @mosaix/auth — GitHub OAuth 2.0 Provider
 */

import { SocialAuthProvider } from "../social-auth-provider.js";
import type {
  SocialProviderConfig,
  OAuthAuthorizationUrlOptions,
  OAuthTokenResponse,
  SocialUserProfile,
} from "../oauth-types.js";

export class GitHubProvider extends SocialAuthProvider {
  readonly id = "github" as const;
  readonly displayName = "GitHub";
  readonly icon = `<svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>`;
  readonly defaultScopes = ["read:user", "user:email"];

  private readonly authEndpoint = "https://github.com/login/oauth/authorize";
  private readonly tokenEndpoint = "https://github.com/login/oauth/access_token";
  private readonly userEndpoint = "https://api.github.com/user";
  private readonly emailsEndpoint = "https://api.github.com/user/emails";

  constructor(config: SocialProviderConfig) {
    super(config);
  }

  getAuthorizationUrl(options: OAuthAuthorizationUrlOptions): string {
    const scopes = options.scopes || this.config.scopes || this.defaultScopes;
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: options.redirectUri,
      scope: scopes.join(" "),
      state: options.state,
      allow_signup: "true",
    });

    if (options.loginHint) {
      params.set("login", options.loginHint);
    }

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
    });

    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub token exchange failed (${response.status}): ${errorText}`);
    }

    const data = await response.json() as Record<string, unknown>;
    if (data.error) {
      throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
    }

    return {
      accessToken: String(data.access_token || ""),
      tokenType: data.token_type ? String(data.token_type) : undefined,
      scope: data.scope ? String(data.scope) : undefined,
      raw: data,
    };
  }

  async getUserProfile(tokenResponse: OAuthTokenResponse): Promise<SocialUserProfile> {
    const userRes = await fetch(this.userEndpoint, {
      headers: {
        Authorization: `Bearer ${tokenResponse.accessToken}`,
        "User-Agent": "MosaiX-SocialLogin/1.0",
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!userRes.ok) {
      throw new Error(`GitHub user fetch failed with status ${userRes.status}`);
    }

    const userData = await userRes.json() as Record<string, unknown>;
    let email = userData.email ? String(userData.email) : undefined;
    let emailVerified = Boolean(email);

    // If email is null (private in GitHub profile), fetch from /user/emails
    if (!email) {
      try {
        const emailsRes = await fetch(this.emailsEndpoint, {
          headers: {
            Authorization: `Bearer ${tokenResponse.accessToken}`,
            "User-Agent": "MosaiX-SocialLogin/1.0",
            Accept: "application/vnd.github.v3+json",
          },
        });

        if (emailsRes.ok) {
          const emailsList = await emailsRes.json() as Array<{
            email: string;
            primary: boolean;
            verified: boolean;
            visibility?: string;
          }>;

          if (Array.isArray(emailsList) && emailsList.length > 0) {
            const primaryEmail = emailsList.find((e) => e.primary && e.verified) ||
              emailsList.find((e) => e.verified) ||
              emailsList[0];

            if (primaryEmail) {
              email = primaryEmail.email;
              emailVerified = primaryEmail.verified;
            }
          }
        }
      } catch {
        // Ignore fallback failure
      }
    }

    const nameParts = typeof userData.name === "string" ? userData.name.trim().split(" ") : [];
    const firstName = nameParts.length > 0 ? nameParts[0] : undefined;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

    return {
      provider: this.id,
      providerUserId: String(userData.id),
      email,
      emailVerified,
      firstName,
      lastName,
      displayName: userData.name ? String(userData.name) : String(userData.login || ""),
      avatarUrl: userData.avatar_url ? String(userData.avatar_url) : undefined,
      rawProfile: userData,
    };
  }
}
