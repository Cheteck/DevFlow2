import { Container } from "@mosaix/container";
import type { ServiceProvider } from "./service-provider";

export class Application extends Container {
  private providers: ServiceProvider[] = [];
  private hasBeenBooted = false;

  /**
   * Register a new service provider inside the application.
   */
  async registerProvider(provider: ServiceProvider): Promise<void> {
    this.providers.push(provider);
    await provider.register();

    // If the application is already booted, boot the provider immediately.
    if (this.hasBeenBooted) {
      await provider.boot();
    }
  }

  /**
   * Boot all registered service providers.
   */
  async boot(): Promise<void> {
    if (this.hasBeenBooted) {
      return;
    }

    for (const provider of this.providers) {
      await provider.boot();
    }

    this.hasBeenBooted = true;
  }

  /**
   * Get all registered service providers.
   */
  getProviders(): ServiceProvider[] {
    return this.providers;
  }

  /**
   * Check if the application is booted.
   */
  isBooted(): boolean {
    return this.hasBeenBooted;
  }
}
