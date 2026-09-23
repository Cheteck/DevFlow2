/**
 * @mosaix/auth — OAuth 2.0 & OpenID Connect Social Login Types
 */

export type SocialProviderType =
  | "google"
  | "apple"
  | "microsoft"
  | "github"
  | "facebook"
  | (string & {});

export interface SocialProviderConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];
  enabled?: boolean;
  // Provider-specific options
  tenant?: string; // Microsoft: 'common', 'organizations', 'consumers', or tenant ID
  teamId?: string; // Apple Developer Team ID
  keyId?: string; // Apple Key ID
  privateKey?: string; // Apple .p8 private key
}

export interface OAuthAuthorizationUrlOptions {
  redirectUri: string;
  state: string;
  codeChallenge?: string;
  codeChallengeMethod?: "S256" | "plain";
  scopes?: string[];
  prompt?: string;
  loginHint?: string;
}

export interface OAuthTokenResponse {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
  refreshToken?: string;
  idToken?: string;
  scope?: string;
  raw?: Record<string, unknown>;
}

export interface SocialUserProfile {
  provider: SocialProviderType;
  providerUserId: string;
  email?: string;
  emailVerified?: boolean;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
  rawProfile?: Record<string, unknown>;
}

export interface OAuthCallbackParams {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
  codeVerifier?: string;
  redirectUri: string;
  userPayload?: string; // Sign in with Apple user JSON
}

export interface OAuthStatePayload {
  provider: SocialProviderType;
  redirectUri: string;
  codeVerifier?: string;
  nonce?: string;
  action?: "login" | "register" | "link";
  userId?: string; // Populated when action === 'link'
  createdAt: number;
}

export interface SocialAccountRecord {
  id: string;
  userId: string;
  provider: SocialProviderType;
  providerUserId: string;
  providerEmail?: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}
