/**
 * @apps/citadelle — Social Account Repository Port & In-Memory Adapter
 */

import type { SocialAccount } from "../domain/social-account.js";

export interface SocialAccountRepository {
  findById(id: string): Promise<SocialAccount | null>;
  findByProvider(provider: string, providerUserId: string): Promise<SocialAccount | null>;
  findByUserId(userId: string): Promise<SocialAccount[]>;
  findByUserAndProvider(userId: string, provider: string): Promise<SocialAccount | null>;
  save(account: SocialAccount): Promise<SocialAccount>;
  delete(id: string): Promise<boolean>;
  deleteByUserAndProvider(userId: string, provider: string): Promise<boolean>;
  countByUserId(userId: string): Promise<number>;
}

export class InMemorySocialAccountRepository implements SocialAccountRepository {
  private readonly accounts = new Map<string, SocialAccount>(); // key: id
  private readonly providerIndex = new Map<string, string>(); // key: `${provider}:${providerUserId}` -> id

  async findById(id: string): Promise<SocialAccount | null> {
    return this.accounts.get(id) || null;
  }

  async findByProvider(provider: string, providerUserId: string): Promise<SocialAccount | null> {
    const key = `${provider}:${providerUserId}`;
    const id = this.providerIndex.get(key);
    if (!id) return null;
    return this.accounts.get(id) || null;
  }

  async findByUserId(userId: string): Promise<SocialAccount[]> {
    const results: SocialAccount[] = [];
    for (const acc of this.accounts.values()) {
      if (acc.userId === userId) {
        results.push(acc);
      }
    }
    return results;
  }

  async findByUserAndProvider(userId: string, provider: string): Promise<SocialAccount | null> {
    for (const acc of this.accounts.values()) {
      if (acc.userId === userId && acc.provider === provider) {
        return acc;
      }
    }
    return null;
  }

  async save(account: SocialAccount): Promise<SocialAccount> {
    const key = `${account.provider}:${account.providerUserId}`;
    const existingId = this.providerIndex.get(key);

    // Enforce uniqueness constraint on (provider, providerUserId)
    if (existingId && existingId !== account.id) {
      throw new Error(`Unique constraint violation: (${account.provider}, ${account.providerUserId}) already associated with account ${existingId}`);
    }

    this.accounts.set(account.id, account);
    this.providerIndex.set(key, account.id);
    return account;
  }

  async delete(id: string): Promise<boolean> {
    const acc = this.accounts.get(id);
    if (!acc) return false;
    const key = `${acc.provider}:${acc.providerUserId}`;
    this.providerIndex.delete(key);
    return this.accounts.delete(id);
  }

  async deleteByUserAndProvider(userId: string, provider: string): Promise<boolean> {
    const acc = await this.findByUserAndProvider(userId, provider);
    if (!acc) return false;
    return this.delete(acc.id);
  }

  async countByUserId(userId: string): Promise<number> {
    let count = 0;
    for (const acc of this.accounts.values()) {
      if (acc.userId === userId) count++;
    }
    return count;
  }
}
