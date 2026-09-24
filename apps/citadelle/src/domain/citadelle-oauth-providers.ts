export type ExternalOAuthProvider = "google" | "github" | "microsoft";

export interface ExternalUserProfile {
  provider: ExternalOAuthProvider;
  providerUserId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export interface OAuthProviderConfig {
  provider: ExternalOAuthProvider;
  clientId: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

export interface OAuthProviderPort {
  getAuthorizationUrl(state: string, redirectUri: string): string;
  exchangeCodeForProfile(code: string, redirectUri: string): Promise<ExternalUserProfile>;
}

export class CitadelleOAuthManager {
  private providers = new Map<ExternalOAuthProvider, OAuthProviderPort>();

  registerProvider(provider: ExternalOAuthProvider, adapter: OAuthProviderPort): void {
    this.providers.set(provider, adapter);
  }

  getProvider(provider: ExternalOAuthProvider): OAuthProviderPort {
    const adapter = this.providers.get(provider);
    if (!adapter) {
      throw new Error(`OAuth provider [${provider}] is not registered.`);
    }
    return adapter;
  }

  hasProvider(provider: ExternalOAuthProvider): boolean {
    return this.providers.has(provider);
  }
}

export class GoogleOAuthProviderAdapter implements OAuthProviderPort {
  constructor(private readonly clientId: string, private readonly clientSecret?: string) {}

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "consent",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForProfile(code: string, _redirectUri: string): Promise<ExternalUserProfile> {
    // In live env, would POST to https://oauth2.googleapis.com/token
    return {
      provider: "google",
      providerUserId: `g_${code.slice(0, 12)}`,
      email: "user@gmail.com",
      displayName: "Google User",
    };
  }
}

export class GitHubOAuthProviderAdapter implements OAuthProviderPort {
  constructor(private readonly clientId: string, private readonly clientSecret?: string) {}

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: "read:user user:email",
      state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForProfile(code: string, _redirectUri: string): Promise<ExternalUserProfile> {
    return {
      provider: "github",
      providerUserId: `gh_${code.slice(0, 12)}`,
      email: "user@github.com",
      displayName: "GitHub Developer",
    };
  }
}

export class MicrosoftOAuthProviderAdapter implements OAuthProviderPort {
  constructor(private readonly clientId: string, private readonly tenantId: string = "common", private readonly clientSecret?: string) {}

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile User.Read",
      state,
    });
    return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCodeForProfile(code: string, _redirectUri: string): Promise<ExternalUserProfile> {
    return {
      provider: "microsoft",
      providerUserId: `ms_${code.slice(0, 12)}`,
      email: "user@outlook.com",
      displayName: "Microsoft User",
    };
  }
}

