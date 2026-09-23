/**
 * @mosaix/auth — Abstract Social Auth Provider Base Class
 */

import * as crypto from "node:crypto";
import type {
  SocialProviderType,
  SocialProviderConfig,
  OAuthAuthorizationUrlOptions,
  OAuthTokenResponse,
  SocialUserProfile,
  OAuthCallbackParams,
} from "./oauth-types.js";

export abstract class SocialAuthProvider {
  abstract readonly id: SocialProviderType;
  abstract readonly displayName: string;
  abstract readonly icon: string;
  abstract readonly defaultScopes: string[];

  constructor(public readonly config: SocialProviderConfig) {}

  get isEnabled(): boolean {
    return this.config.enabled !== false && Boolean(this.config.clientId);
  }

  /**
   * Generates the OAuth 2.0 / OpenID Connect authorization URL.
   */
  abstract getAuthorizationUrl(options: OAuthAuthorizationUrlOptions): Promise<string> | string;

  /**
   * Exchanges authorization code for access & ID tokens.
   */
  abstract exchangeCodeForToken(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<OAuthTokenResponse>;

  /**
   * Fetches and normalizes the social user profile from provider APIs or ID tokens.
   */
  abstract getUserProfile(tokenResponse: OAuthTokenResponse): Promise<SocialUserProfile>;

  /**
   * Complete callback handler: processes params, checks errors, exchanges code, and retrieves profile.
   */
  async handleCallback(
    params: OAuthCallbackParams
  ): Promise<{ tokens: OAuthTokenResponse; profile: SocialUserProfile }> {
    if (params.error) {
      const errDescription = params.errorDescription || params.error;
      throw new Error(`[OAuth Error: ${this.displayName}] ${errDescription}`);
    }

    if (!params.code) {
      throw new Error(`[OAuth Error: ${this.displayName}] Missing authorization code in callback`);
    }

    const tokens = await this.exchangeCodeForToken(
      params.code,
      params.redirectUri,
      params.codeVerifier
    );

    const profile = await this.getUserProfile(tokens);
    const validation = this.validateIdentity(profile);

    if (!validation.valid) {
      throw new Error(`[OAuth Error: ${this.displayName}] Invalid identity: ${validation.reason}`);
    }

    return { tokens, profile };
  }

  /**
   * Validates social profile integrity.
   */
  validateIdentity(profile: SocialUserProfile): { valid: boolean; reason?: string } {
    if (!profile.providerUserId || typeof profile.providerUserId !== "string") {
      return { valid: false, reason: "Missing provider user ID" };
    }
    if (profile.provider !== this.id) {
      return { valid: false, reason: `Provider mismatch: expected ${this.id}, got ${profile.provider}` };
    }
    return { valid: true };
  }

  // ==========================================
  // Cryptographic & PKCE Helper Utilities
  // ==========================================

  /**
   * Generates a cryptographically random PKCE code verifier (RFC 7636).
   */
  static generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString("base64url");
  }

  /**
   * Computes SHA-256 code challenge from a code verifier.
   */
  static computeCodeChallenge(codeVerifier: string): string {
    return crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
  }

  /**
   * Generates a secure anti-CSRF state token.
   */
  static generateState(): string {
    return crypto.randomBytes(24).toString("hex");
  }

  /**
   * Generates a secure OpenID Connect nonce.
   */
  static generateNonce(): string {
    return crypto.randomBytes(16).toString("hex");
  }
}
