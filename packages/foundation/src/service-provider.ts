import type { Container } from "@mosaix/container";

export abstract class ServiceProvider {
  protected container: Container;

  constructor(container: Container) {
    this.container = container;
  }

  /**
   * Register bindings inside the container.
   */
  abstract register(): void | Promise<void>;

  /**
   * Boot the service provider.
   */
  abstract boot(): void | Promise<void>;
}
