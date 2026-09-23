/**
 * @mosaix/auth — Central Social Auth Service & Orchestrator
 */

import type {
  SocialProviderType,
  SocialProviderConfig,
  OAuthStatePayload,
  SocialAccountRecord,
} from "./oauth-types.js";
import { SocialAuthProvider } from "./social-auth-provider.js";
import { GoogleProvider } from "./providers/google-provider.js";
import { AppleProvider } from "./providers/apple-provider.js";
import { MicrosoftProvider } from "./providers/microsoft-provider.js";
import { GitHubProvider } from "./providers/github-provider.js";
import { FacebookProvider } from "./providers/facebook-provider.js";

export interface SocialAuthServiceOptions {
  providers?: SocialAuthProvider[];
  stateTtlMs?: number;
}

export interface SocialAuthSuccessResult {
  status: "authenticated" | "linked" | "conflict_existing_email";
  user?: {
    id: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
    role?: string;
  };
  socialAccount?: SocialAccountRecord;
  provider: SocialProviderType;
  error?: string;
}

export class SocialAuthService {
  private readonly providers = new Map<string, SocialAuthProvider>();
  private readonly stateSessions = new Map<string, OAuthStatePayload>();
  private readonly socialAccounts = new Map<string, SocialAccountRecord>(); // key: `${provider}:${providerUserId}`
  private readonly userAccounts = new Map<string, Array<string>>(); // key: userId, value: array of account keys
  private readonly userPasswordRegistry = new Set<string>(); // userIds that have local password
  private readonly stateTtlMs: number;

  constructor(options: SocialAuthServiceOptions = {}) {
    this.stateTtlMs = options.stateTtlMs || 10 * 60 * 1000; // 10 minutes TTL

    if (options.providers) {
      for (const provider of options.providers) {
        this.registerProvider(provider);
      }
    } else {
      this.initDefaultProvidersFromEnv();
    }
  }

  /**
   * Initializes standard providers from environment variables.
   */
  private initDefaultProvidersFromEnv(): void {
    const googleConfig: SocialProviderConfig = {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: Boolean(process.env.GOOGLE_CLIENT_ID),
    };
    const appleConfig: SocialProviderConfig = {
      clientId: process.env.APPLE_CLIENT_ID || "",
      clientSecret: process.env.APPLE_CLIENT_SECRET || "",
      teamId: process.env.APPLE_TEAM_ID,
      keyId: process.env.APPLE_KEY_ID,
      privateKey: process.env.APPLE_PRIVATE_KEY,
      enabled: Boolean(process.env.APPLE_CLIENT_ID),
    };
    const msConfig: SocialProviderConfig = {
      clientId: process.env.MICROSOFT_CLIENT_ID || "",
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "",
      tenant: process.env.MICROSOFT_TENANT || "common",
      enabled: Boolean(process.env.MICROSOFT_CLIENT_ID),
    };
    const ghConfig: SocialProviderConfig = {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      enabled: Boolean(process.env.GITHUB_CLIENT_ID),
    };
    const fbConfig: SocialProviderConfig = {
      clientId: process.env.FACEBOOK_CLIENT_ID || "",
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || "",
      enabled: Boolean(process.env.FACEBOOK_CLIENT_ID),
    };

    this.registerProvider(new GoogleProvider(googleConfig));
    this.registerProvider(new AppleProvider(appleConfig));
    this.registerProvider(new MicrosoftProvider(msConfig));
    this.registerProvider(new GitHubProvider(ghConfig));
    this.registerProvider(new FacebookProvider(fbConfig));
  }

  registerProvider(provider: SocialAuthProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): SocialAuthProvider | undefined {
    return this.providers.get(id);
  }

  listProviders(): Array<{
    id: string;
    displayName: string;
    icon: string;
    enabled: boolean;
  }> {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      displayName: p.displayName,
      icon: p.icon,
      enabled: p.isEnabled,
    }));
  }

  /**
   * Creates an OAuth authorization session with anti-CSRF state and PKCE challenge.
   */
  async createAuthorizationSession(params: {
    providerId: string;
    redirectUri: string;
    action?: "login" | "register" | "link";
    userId?: string;
    loginHint?: string;
  }): Promise<{ url: string; state: string }> {
    const provider = this.providers.get(params.providerId);
    if (!provider) {
      throw new Error(`Provider '${params.providerId}' is not registered`);
    }

    const state = SocialAuthProvider.generateState();
    const codeVerifier = SocialAuthProvider.generateCodeVerifier();
    const codeChallenge = SocialAuthProvider.computeCodeChallenge(codeVerifier);

    const sessionPayload: OAuthStatePayload = {
      provider: params.providerId,
      redirectUri: params.redirectUri,
      codeVerifier,
      action: params.action || "login",
      userId: params.userId,
      createdAt: Date.now(),
    };

    this.stateSessions.set(state, sessionPayload);

    // Clean up expired states
    this.cleanupExpiredStates();

    const authUrl = await provider.getAuthorizationUrl({
      redirectUri: params.redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod: "S256",
      loginHint: params.loginHint,
    });

    return { url: authUrl, state };
  }

  /**
   * Validates state and retrieves the corresponding session (anti-CSRF protection).
   */
  validateAndConsumeState(state?: string): OAuthStatePayload {
    if (!state) {
      throw new Error("Missing state parameter in callback");
    }

    const session = this.stateSessions.get(state);
    if (!session) {
      throw new Error("Invalid or expired OAuth state parameter (CSRF protection failed)");
    }

    this.stateSessions.delete(state);

    if (Date.now() - session.createdAt > this.stateTtlMs) {
      throw new Error("OAuth session has expired, please restart authentication");
    }

    return session;
  }

  /**
   * Orchestrates the complete OAuth resolution flow.
   */
  async handleCallback(params: {
    providerId: string;
    code?: string;
    state?: string;
    error?: string;
    errorDescription?: string;
    redirectUri: string;
    userPayload?: string;
    findUserByEmail?: (email: string) => Promise<{ id: string; email: string; displayName?: string } | null>;
    createUser?: (data: { email?: string; displayName?: string; avatarUrl?: string }) => Promise<{ id: string; email?: string; displayName?: string }>;
  }): Promise<SocialAuthSuccessResult> {
    const stateSession = this.validateAndConsumeState(params.state);
    const provider = this.providers.get(params.providerId);

    if (!provider) {
      throw new Error(`Unknown OAuth provider: ${params.providerId}`);
    }

    // Process token exchange & profile retrieval via provider
    const { profile } = await provider.handleCallback({
      code: params.code,
      state: params.state,
      error: params.error,
      errorDescription: params.errorDescription,
      codeVerifier: stateSession.codeVerifier,
      redirectUri: params.redirectUri || stateSession.redirectUri,
      userPayload: params.userPayload,
    });

    const accountKey = `${profile.provider}:${profile.providerUserId}`;
    const existingSocialAccount = this.socialAccounts.get(accountKey);

    // Scenario 1: Account Linking flow (user is already logged in)
    if (stateSession.action === "link" && stateSession.userId) {
      if (existingSocialAccount && existingSocialAccount.userId !== stateSession.userId) {
        throw new Error(`This ${provider.displayName} account is already linked to another MosaiX user`);
      }

      const linkedAccount = this.saveSocialAccount({
        userId: stateSession.userId,
        provider: profile.provider,
        providerUserId: profile.providerUserId,
        providerEmail: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        metadata: profile.rawProfile,
      });

      return {
        status: "linked",
        provider: profile.provider,
        socialAccount: linkedAccount,
      };
    }

    // Scenario 2: Existing User with matching social account
    if (existingSocialAccount) {
      return {
        status: "authenticated",
        provider: profile.provider,
        user: {
          id: existingSocialAccount.userId,
          email: existingSocialAccount.providerEmail,
          displayName: existingSocialAccount.displayName,
          avatarUrl: existingSocialAccount.avatarUrl,
          role: "member",
        },
        socialAccount: existingSocialAccount,
      };
    }

    // Scenario 3: Email exists on another local account (anti-silent-merge)
    if (profile.email && params.findUserByEmail) {
      const existingUserByEmail = await params.findUserByEmail(profile.email);
      if (existingUserByEmail) {
        // If email is not verified by provider, prevent linking
        if (!profile.emailVerified) {
          return {
            status: "conflict_existing_email",
            provider: profile.provider,
            error: `An account with email ${profile.email} exists, but the email provided by ${provider.displayName} is not verified. Please log in with password to link accounts.`,
          };
        }

        // Link social account directly to existing verified user
        const newAccount = this.saveSocialAccount({
          userId: existingUserByEmail.id,
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          providerEmail: profile.email,
          displayName: profile.displayName || existingUserByEmail.displayName,
          avatarUrl: profile.avatarUrl,
          metadata: profile.rawProfile,
        });

        return {
          status: "authenticated",
          provider: profile.provider,
          user: {
            id: existingUserByEmail.id,
            email: existingUserByEmail.email,
            displayName: existingUserByEmail.displayName,
            avatarUrl: profile.avatarUrl,
            role: "member",
          },
          socialAccount: newAccount,
        };
      }
    }

    // Scenario 4: Brand new user creation
    let newUserId = `usr_${Math.random().toString(36).substring(2, 11)}`;
    let userDisplayName = profile.displayName || profile.firstName || (profile.email ? profile.email.split("@")[0] : "New Member");

    if (params.createUser) {
      const created = await params.createUser({
        email: profile.email,
        displayName: userDisplayName,
        avatarUrl: profile.avatarUrl,
      });
      newUserId = created.id;
      userDisplayName = created.displayName || userDisplayName;
    }

    const newSocialAccount = this.saveSocialAccount({
      userId: newUserId,
      provider: profile.provider,
      providerUserId: profile.providerUserId,
      providerEmail: profile.email,
      displayName: userDisplayName,
      avatarUrl: profile.avatarUrl,
      metadata: profile.rawProfile,
    });

    return {
      status: "authenticated",
      provider: profile.provider,
      user: {
        id: newUserId,
        email: profile.email,
        displayName: userDisplayName,
        avatarUrl: profile.avatarUrl,
        role: "member",
      },
      socialAccount: newSocialAccount,
    };
  }

  saveSocialAccount(data: {
    userId: string;
    provider: SocialProviderType;
    providerUserId: string;
    providerEmail?: string;
    displayName?: string;
    avatarUrl?: string;
    metadata?: Record<string, unknown>;
  }): SocialAccountRecord {
    const key = `${data.provider}:${data.providerUserId}`;
    const now = new Date().toISOString();

    const record: SocialAccountRecord = {
      id: `soc_${Math.random().toString(36).substring(2, 11)}`,
      userId: data.userId,
      provider: data.provider,
      providerUserId: data.providerUserId,
      providerEmail: data.providerEmail,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
      createdAt: now,
      updatedAt: now,
      metadata: data.metadata,
    };

    this.socialAccounts.set(key, record);

    const userKeys = this.userAccounts.get(data.userId) || [];
    if (!userKeys.includes(key)) {
      userKeys.push(key);
      this.userAccounts.set(data.userId, userKeys);
    }

    return record;
  }

  getSocialAccountsForUser(userId: string): SocialAccountRecord[] {
    const keys = this.userAccounts.get(userId) || [];
    const accounts: SocialAccountRecord[] = [];
    for (const key of keys) {
      const acc = this.socialAccounts.get(key);
      if (acc) accounts.push(acc);
    }
    return accounts;
  }

  setUserHasPassword(userId: string, hasPassword: boolean): void {
    if (hasPassword) {
      this.userPasswordRegistry.add(userId);
    } else {
      this.userPasswordRegistry.delete(userId);
    }
  }

  /**
   * Unlinks a provider from user account while enforcing security constraints:
   * Prevents account lockout if user has no password and only this social account.
   */
  unlinkProvider(userId: string, provider: SocialProviderType): { success: boolean; error?: string } {
    const userKeys = this.userAccounts.get(userId) || [];
    const targetKey = userKeys.find((k) => k.startsWith(`${provider}:`));

    if (!targetKey) {
      return { success: false, error: `No linked account found for provider ${provider}` };
    }

    const hasPassword = this.userPasswordRegistry.has(userId);
    const otherSocialAccounts = userKeys.filter((k) => k !== targetKey);

    if (!hasPassword && otherSocialAccounts.length === 0) {
      return {
        success: false,
        error: "Cannot unlink your only sign-in method. Please set a password or link another provider first.",
      };
    }

    this.socialAccounts.delete(targetKey);
    this.userAccounts.set(userId, otherSocialAccounts);

    return { success: true };
  }

  private cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [state, session] of this.stateSessions.entries()) {
      if (now - session.createdAt > this.stateTtlMs) {
        this.stateSessions.delete(state);
      }
    }
  }
}

export const socialAuthService = new SocialAuthService();
