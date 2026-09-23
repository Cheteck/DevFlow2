import type { IdentityStore, UserIdentity } from "@mosaix/ports-identity-store";

export class InMemoryIdentityStore implements IdentityStore {
  private users = new Map<string, UserIdentity>();

  async findById(id: string): Promise<UserIdentity | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<UserIdentity | null> {
    for (const u of this.users.values()) {
      if (u.email === email) return u;
    }
    return null;
  }

  async create(user: UserIdentity): Promise<UserIdentity> {
    this.users.set(user.id, user);
    return user;
  }

  async update(id: string, user: Partial<UserIdentity>): Promise<UserIdentity | null> {
    const existing = this.users.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...user };
    this.users.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.users.delete(id);
  }
}
