import type { ConfigPort } from "@mosaix/ports-config";

export class EnvConfigAdapter implements ConfigPort {
  private readonly source: Record<string, string | undefined>;

  constructor(customSource?: Record<string, string | undefined>) {
    this.source = customSource ?? process.env;
  }

  get(key: string): string | undefined {
    return this.source[key];
  }

  getOrDefault(key: string, defaultValue: string): string {
    return this.source[key] ?? defaultValue;
  }

  getRequired(key: string): string {
    const val = this.source[key];
    if (val === undefined) {
      throw new Error(`Required configuration key "${key}" is missing`);
    }
    return val;
  }
}
