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
