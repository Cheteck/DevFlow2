import type { SecretsPort } from "@mosaix/ports-secrets";

export class InMemorySecretsAdapter implements SecretsPort {
  private secrets = new Map<string, string>();

  async getSecret(key: string): Promise<string | undefined> {
    return this.secrets.get(key) ?? process.env[key] ?? "dev-secret-key-123";
  }

  async getRequiredSecret(key: string): Promise<string> {
    const secret = await this.getSecret(key);
    if (!secret) {
      throw new Error(`Required secret '${key}' is missing`);
    }
    return secret;
  }

  async setSecret(key: string, value: string): Promise<void> {
    this.secrets.set(key, value);
  }
}
