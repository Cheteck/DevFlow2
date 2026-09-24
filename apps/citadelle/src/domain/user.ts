import type { UserModel } from "./user.model.js";

export interface UserOptions {
  passwordHash?: string;
  roles?: string[];
  emailVerified?: boolean;
  lastLoginAt?: string;
  mfaEnabled?: boolean;
  mfaSecret?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class User implements UserModel {
  public passwordHash?: string;
  public roles: string[];
  public emailVerified: boolean;
  public lastLoginAt?: string;
  public mfaEnabled: boolean;
  public mfaSecret?: string;
  public readonly createdAt: string;
  public updatedAt: string;

  constructor(
    public readonly id: string,
    public email: string,
    public displayName: string,
    options: UserOptions = {},
  ) {
    this.passwordHash = options.passwordHash;
    this.roles = options.roles && options.roles.length > 0 ? options.roles : ["citizen"];
    this.emailVerified = options.emailVerified ?? false;
    this.lastLoginAt = options.lastLoginAt;
    this.mfaEnabled = options.mfaEnabled ?? false;
    this.mfaSecret = options.mfaSecret;
    this.createdAt = options.createdAt || new Date().toISOString();
    this.updatedAt = options.updatedAt || new Date().toISOString();
  }
}

