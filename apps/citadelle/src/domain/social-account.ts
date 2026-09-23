/**
 * @apps/citadelle — Social Account Domain Model
 */

export interface SocialAccountModel {
  id: string;
  userId: string;
  provider: string;
  providerUserId: string;
  providerEmail?: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export class SocialAccount implements SocialAccountModel {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly provider: string,
    public readonly providerUserId: string,
    public providerEmail?: string,
    public displayName?: string,
    public avatarUrl?: string,
    public readonly createdAt: string = new Date().toISOString(),
    public updatedAt: string = new Date().toISOString(),
    public metadata?: Record<string, unknown>,
  ) {}
}
