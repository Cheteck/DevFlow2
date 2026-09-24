import * as crypto from "node:crypto";
import { User, type UserOptions } from "./user.js";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<User>;
  delete?(id: string): Promise<boolean>;
}

export interface CreateUserData {
  id?: string;
  email: string;
  displayName: string;
  passwordHash?: string;
  roles?: string[];
  emailVerified?: boolean;
  mfaEnabled?: boolean;
  mfaSecret?: string;
}

export class UserService {
  constructor(private readonly repo: UserRepository) {}

  async create(data: CreateUserData): Promise<User> {
    const existing = await this.repo.findByEmail(data.email);
    if (existing) {
      return existing;
    }
    const id = data.id || `user_${crypto.randomUUID()}`;
    const options: UserOptions = {
      passwordHash: data.passwordHash,
      roles: data.roles || ["citizen"],
      emailVerified: data.emailVerified ?? false,
      mfaEnabled: data.mfaEnabled ?? false,
      mfaSecret: data.mfaSecret,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const user = new User(id, data.email, data.displayName, options);
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

  // --- RGPD Compliance Operations ---

  async anonymize(userId: string): Promise<User | null> {
    const user = await this.repo.findById(userId);
    if (!user) return null;

    user.email = `anonymized_${crypto.randomUUID().slice(0, 8)}@privacy.local`;
    user.displayName = "Utilisateur Anonymisé";
    user.passwordHash = undefined;
    user.mfaSecret = undefined;
    user.mfaEnabled = false;
    user.updatedAt = new Date().toISOString();

    return this.repo.save(user);
  }

  async exportData(userId: string): Promise<Record<string, unknown> | null> {
    const user = await this.repo.findById(userId);
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      exportTimestamp: new Date().toISOString(),
    };
  }

  async deleteData(userId: string): Promise<boolean> {
    if (this.repo.delete) {
      return this.repo.delete(userId);
    }
    const user = await this.repo.findById(userId);
    if (!user) return false;
    user.email = `deleted_${crypto.randomUUID()}@deleted.local`;
    user.displayName = "[Compte Supprimé]";
    user.roles = [];
    user.passwordHash = undefined;
    user.mfaSecret = undefined;
    user.updatedAt = new Date().toISOString();
    await this.repo.save(user);
    return true;
  }
}

