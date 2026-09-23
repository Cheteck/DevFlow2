/**
 * ConfigPort — Decouples application configuration lookup.
 */
export interface ConfigPort {
  /** Gets the configuration value for a key, or undefined if not found. */
  get(key: string): string | undefined;
  /** Gets the configuration value, or a default value if not found. */
  getOrDefault(key: string, defaultValue: string): string;
  /** Gets the configuration value, or throws an error if not found. */
  getRequired(key: string): string;
}
