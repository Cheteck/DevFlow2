import type { TokenStore } from "@mosaix/ports-token-store";

export class InMemoryTokenStore implements TokenStore {
  private tokens = new Map<string, { userId: string; expiresAt: Date }>();

  async saveToken(token: string, userId: string, ttlSeconds: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    this.tokens.set(token, { userId, expiresAt });
  }

  async verifyToken(token: string): Promise<string | null> {
    const data = this.tokens.get(token);
    if (!data) return null;
    if (data.expiresAt < new Date()) {
      this.tokens.delete(token);
      return null;
    }
    return data.userId;
  }

  async revokeToken(token: string): Promise<void> {
    this.tokens.delete(token);
  }
}
