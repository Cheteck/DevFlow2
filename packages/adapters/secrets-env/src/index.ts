import type { SecretsPort } from "@mosaix/ports-secrets";

export class EnvSecretsAdapter implements SecretsPort {
  private readonly source: Record<string, string | undefined>;

  constructor(customSource?: Record<string, string | undefined>) {
    this.source = customSource ?? process.env;
  }

  async getSecret(key: string): Promise<string | undefined> {
    return this.source[key];
  }

  async getRequiredSecret(key: string): Promise<string> {
    const val = this.source[key];
    if (val === undefined) {
      throw new Error(`Required secret key "${key}" is missing`);
    }
    return val;
  }
}
