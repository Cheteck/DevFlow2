export interface UserModel {
  id: string;
  email: string;
  displayName: string;
  passwordHash?: string;
  roles: string[];
  emailVerified: boolean;
  lastLoginAt?: string;
  mfaEnabled: boolean;
  mfaSecret?: string;
  createdAt: string;
  updatedAt: string;
}

