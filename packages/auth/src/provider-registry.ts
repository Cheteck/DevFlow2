import type { AuthenticationProvider } from "@mosaix/contracts";

export interface ProviderRegistryOptions {
  providers?: AuthenticationProvider[];
}

export class ProviderRegistry {
  private readonly providers = new Map<string, AuthenticationProvider>();

  constructor(options: ProviderRegistryOptions = {}) {
    for (const provider of options.providers ?? []) {
      this.register(provider);
    }
  }

  register(provider: AuthenticationProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): AuthenticationProvider | undefined {
    return this.providers.get(id);
  }

  list(): AuthenticationProvider[] {
    return Array.from(this.providers.values());
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  clear(): void {
    this.providers.clear();
  }

  getProviders(): Map<string, AuthenticationProvider> {
    return this.providers;
  }
}
