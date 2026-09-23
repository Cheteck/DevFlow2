import type { User } from "./user.js";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<User>;
}

export class UserService {
  constructor(private readonly repo: UserRepository) {}

  async create(data: { id?: string; email: string; displayName: string }): Promise<User> {
    const existing = await this.repo.findByEmail(data.email);
    if (existing) {
      return existing;
    }
    const id = data.id || `user_${Math.random().toString(36).slice(2, 11)}`;
    const user: User = {
      id,
      email: data.email,
      displayName: data.displayName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return this.repo.save(user);
  }

  async lookup(query: { id?: string; email?: string }): Promise<User | null> {
    if (query.id) {
      return this.repo.findById(query.id);
    }
    if (query.email) {
      return this.repo.findByEmail(query.email);
    }
    return null;
  }
}
