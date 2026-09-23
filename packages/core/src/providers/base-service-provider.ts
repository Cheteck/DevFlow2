import type { Container, ServiceProvider } from "@mosaix/container";

/**
 * @mosaix/core — Base Service Provider (AdonisJS-inspired)
 */
export abstract class BaseServiceProvider implements ServiceProvider {
  constructor(protected container: Container) {}

  abstract register(container: Container): void | Promise<void>;

  async boot?(_container: Container, _router?: unknown): Promise<void> {
    // Optional hook override in concrete providers
  }
}
