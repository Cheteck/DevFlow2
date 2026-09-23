/**
 * SecretsPort — Decouples application secrets retrieval (e.g. API keys, DB credentials).
 */
export interface SecretsPort {
  /** Asynchronously retrieves a secret value by its key. */
  getSecret(key: string): Promise<string | undefined>;
  /** Asynchronously retrieves a secret, or throws an error if not found. */
  getRequiredSecret(key: string): Promise<string>;
}
