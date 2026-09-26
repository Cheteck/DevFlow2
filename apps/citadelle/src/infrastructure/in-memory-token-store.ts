import type { TokenEntry, TokenStore } from "@mosaix/ports-token-store";

export class InMemoryTokenStore implements TokenStore {
  private tokens = new Map<string, TokenEntry>();

  async save(entry: TokenEntry): Promise<void> {
    this.tokens.set(entry.tokenId, { ...entry });
  }

  async findById(tokenId: string): Promise<TokenEntry | null> {
    const entry = this.tokens.get(tokenId);
    if (!entry) return null;
    if (entry.revokedAt !== undefined) return null;
    if (new Date(entry.expiresAt) < new Date()) {
      this.tokens.delete(tokenId);
      return null;
    }
    return { ...entry };
  }

  async revoke(tokenId: string): Promise<void> {
    const entry = this.tokens.get(tokenId);
    if (entry) {
      this.tokens.set(tokenId, {
        ...entry,
        revokedAt: new Date().toISOString(),
      });
    }
  }

  async revokeAllForSession(sessionId: string): Promise<void> {
    for (const [id, entry] of this.tokens) {
      if (entry.sessionId === sessionId) {
        this.tokens.set(id, {
          ...entry,
          revokedAt: new Date().toISOString(),
        });
      }
    }
  }
}
