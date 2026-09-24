import type { User } from "../domain/user.js";
import type { UserRepository } from "../domain/user-service.js";
import { InMemoryGuard } from "@mosaix/support";

export class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User>();

  constructor() {
    InMemoryGuard.reportFallback("InMemoryUserRepository");
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const u of this.users.values()) {
      if (u.email === email) return u;
    }
    return null;
  }

  async save(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async delete(id: string): Promise<boolean> {
    return this.users.delete(id);
  }
}
