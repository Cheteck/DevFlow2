import type { SecretsPort } from "@mosaix/ports-secrets";

export class InMemorySecretsAdapter implements SecretsPort {
  private secrets = new Map<string, string>();

  async getSecret(key: string): Promise<string | undefined> {
    return this.secrets.get(key) ?? process.env[key] ?? (process.env.NODE_ENV === "test" ? "dev-secret-key-123" : undefined);
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
