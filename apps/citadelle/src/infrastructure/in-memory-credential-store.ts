import * as crypto from "node:crypto";
import type { CredentialStore, Credential, SaveCredentialInput } from "@mosaix/ports-credential-store";

export class InMemoryCredentialStore implements CredentialStore {
  private credentials = new Map<string, Credential>();

  async get(identityId: string, type: string): Promise<Credential | null> {
    for (const cred of this.credentials.values()) {
      if (cred.identityId === identityId && cred.type === type && !cred.revokedAt) {
        return cred;
      }
    }
    return null;
  }

  async save(input: SaveCredentialInput): Promise<Credential> {
    const id = `cred_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const cred: Credential = {
      id,
      identityId: input.identityId,
      type: input.type,
      data: input.data,
      expiresAt: input.expiresAt,
      createdAt: now,
      updatedAt: now,
    };
    this.credentials.set(id, cred);
    return cred;
  }

  async revoke(credentialId: string): Promise<void> {
    const cred = this.credentials.get(credentialId);
    if (cred) {
      cred.revokedAt = new Date().toISOString();
    }
  }

  async revokeAllForIdentity(identityId: string): Promise<void> {
    for (const cred of this.credentials.values()) {
      if (cred.identityId === identityId) {
        cred.revokedAt = new Date().toISOString();
      }
    }
  }
}
