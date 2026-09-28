import type { SecretsPort } from "@mosaix/ports-secrets";
import { isDemoMode } from "@mosaix/support";

export class EnvSecretsAdapter implements SecretsPort {
  private readonly source: Record<string, string | undefined>;

  constructor(customSource?: Record<string, string | undefined>) {
    this.source = customSource ?? process.env;
  }

  async getSecret(key: string): Promise<string | undefined> {
    const val = this.source[key];
    if (!val && !isDemoMode() && key.startsWith("MOSAIX_")) {
      throw new Error(`[EnvSecretsAdapter] Secret key "${key}" must be set when MOSAIX_DEMO_USERS=false.`);
    }
    return val;
  }

  async getRequiredSecret(key: string): Promise<string> {
    const val = this.source[key];
    if (val === undefined || val === "") {
      throw new Error(`Required secret key "${key}" is missing`);
    }
    return val;
  }
}
