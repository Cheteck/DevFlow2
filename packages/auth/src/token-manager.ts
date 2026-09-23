import type { TokenResult, TokenType } from "@mosaix/contracts";
import type { TokenStore, TokenEntry } from "@mosaix/ports-token-store";
import type { IdGeneratorPort } from "@mosaix/ports-id";

export interface TokenManagerOptions {
  defaultTtlSeconds?: number;
}

export class TokenManager {
  private readonly defaultTtlSeconds: number;
  private readonly idGenerator: IdGeneratorPort;

  constructor(
    private readonly tokenStore: TokenStore,
    idGenerator: IdGeneratorPort,
    options: TokenManagerOptions = {},
  ) {
    this.idGenerator = idGenerator;
    this.defaultTtlSeconds = options.defaultTtlSeconds ?? 3600;
  }

  async generate(
    identityId: string,
    sessionId: string,
    tokenType: TokenType,
    ttlSeconds?: number,
  ): Promise<TokenResult> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (ttlSeconds ?? this.defaultTtlSeconds) * 1000,
    ).toISOString();

    const accessToken = this.generateToken();
    const tokenId = accessToken;

    const entry: TokenEntry = {
      tokenId,
      identityId,
      sessionId,
      type: tokenType,
      expiresAt,
      attributes: {},
    };

    await this.tokenStore.save(entry);
    const refreshToken =
      tokenType === "access" ? this.generateToken() : undefined;
    return {
      accessToken,
      tokenType,
      expiresIn: ttlSeconds ?? this.defaultTtlSeconds,
      ...(refreshToken !== undefined ? { refreshToken } : {}),
    };
  }

  async validate(tokenId: string): Promise<TokenEntry | null> {
    const entry = await this.tokenStore.findById(tokenId);
    if (!entry) return null;

    if (entry.revokedAt !== undefined) return null;
    if (new Date(entry.expiresAt) < new Date()) return null;

    return entry;
  }

  async revoke(tokenId: string): Promise<void> {
    await this.tokenStore.revoke(tokenId);
  }

  async revokeAllForSession(sessionId: string): Promise<void> {
    await this.tokenStore.revokeAllForSession(sessionId);
  }

  private generateToken(): string {
    const bytes = this.idGenerator.randomBytes(32);
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }
}
