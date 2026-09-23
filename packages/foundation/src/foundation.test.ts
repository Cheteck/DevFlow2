import { describe, it, expect } from "vitest";
import { Application } from "./application";
import { ServiceProvider } from "./service-provider";

class TestServiceProvider extends ServiceProvider {
  register(): void {
    this.container.bind("foo", () => "registered-foo");
  }

  boot(): void {
    this.container.bind("bar", () => "booted-bar");
  }
}

describe("Foundation (Service Providers & Application Bootstrapper)", () => {
  it("should register and boot service providers in order", async () => {
    const app = new Application();
    const provider = new TestServiceProvider(app);

    await app.registerProvider(provider);

    expect(app.getProviders()).toContain(provider);
    expect(app.isBooted()).toBe(false);

    // foo should be bound after register, but bar should NOT be bound yet.
    expect(app.has("foo")).toBe(true);
    expect(app.make("foo")).toBe("registered-foo");
    expect(app.has("bar")).toBe(false);

    // Boot the application.
    await app.boot();

    expect(app.isBooted()).toBe(true);
    expect(app.has("bar")).toBe(true);
    expect(app.make("bar")).toBe("booted-bar");
  });

  it("should boot new providers immediately if application is already booted", async () => {
    const app = new Application();
    await app.boot();

    expect(app.isBooted()).toBe(true);

    const provider = new TestServiceProvider(app);
    await app.registerProvider(provider);

    expect(app.has("foo")).toBe(true);
    expect(app.has("bar")).toBe(true);
    expect(app.make("foo")).toBe("registered-foo");
    expect(app.make("bar")).toBe("booted-bar");
  });
});
