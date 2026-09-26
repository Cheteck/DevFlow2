import type {
  ExternalIdentity,
  Identity,
  IdentityStore,
  LinkExternalIdentityInput,
} from "@mosaix/ports-identity-store";

export class InMemoryIdentityStore implements IdentityStore {
  private users = new Map<string, Identity>();

  async findById(id: string): Promise<Identity | null> {
    return this.users.get(id) ?? null;
  }

  async findByExternalIdentity(provider: string, externalId: string): Promise<Identity | null> {
    for (const identity of this.users.values()) {
      if (
        identity.externalIdentities.some(
          (link) => link.provider === provider && link.externalId === externalId,
        )
      ) {
        return identity;
      }
    }
    return null;
  }

  async findByEmail(email: string): Promise<Identity | null> {
    for (const identity of this.users.values()) {
      if (identity.email === email) return identity;
    }
    return null;
  }

  async create(identity: Identity): Promise<void> {
    this.users.set(identity.id, { ...identity });
  }

  async update(identity: Identity): Promise<void> {
    const existing = this.users.get(identity.id);
    this.users.set(identity.id, { ...existing, ...identity });
  }

  async linkExternalIdentity(input: LinkExternalIdentityInput): Promise<ExternalIdentity> {
    const identity = this.users.get(input.identityId);
    if (!identity) throw new Error(`Identity [${input.identityId}] not found.`);
    const link: ExternalIdentity = {
      provider: input.provider,
      externalId: input.externalId,
      linkedAt: new Date().toISOString(),
      ...(input.attributes !== undefined ? { attributes: input.attributes } : {}),
    };
    identity.externalIdentities = [
      ...identity.externalIdentities.filter(
        (existing) =>
          existing.provider !== link.provider || existing.externalId !== link.externalId,
      ),
      link,
    ];
    identity.updatedAt = new Date().toISOString();
    return link;
  }

  async unlinkExternalIdentity(identityId: string, provider: string, externalId: string): Promise<void> {
    const identity = this.users.get(identityId);
    if (!identity) return;
    identity.externalIdentities = identity.externalIdentities.filter(
      (link) => link.provider !== provider || link.externalId !== externalId,
    );
    identity.updatedAt = new Date().toISOString();
  }
}
