/**
 * @mosaix/config — Secret Vault & KMS Dynamic Resolver (Phase 18)
 */

export interface SecretStore {
  getSecret(key: string): Promise<string | undefined>;
}

export class SecretVaultResolver {
  private secretStore: SecretStore | undefined = undefined;

  constructor(secretStore?: SecretStore) {
    this.secretStore = secretStore;
  }

  setSecretStore(store: SecretStore): void {
    this.secretStore = store;
  }

  async resolveSecret(key: string, fallbackEnvVar?: string): Promise<string | undefined> {
    if (this.secretStore) {
      try {
        const val = await this.secretStore.getSecret(key);
        if (val) return val;
      } catch {
        // Fall back to environment variable if secret store is unavailable
      }
    }
    if (fallbackEnvVar && process.env[fallbackEnvVar]) {
      return process.env[fallbackEnvVar];
    }
    return process.env[key];
  }
}

export const secretVaultResolver = new SecretVaultResolver();
