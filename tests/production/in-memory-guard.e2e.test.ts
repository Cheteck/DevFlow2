/**
 * @tests/production/in-memory-guard.e2e.test.ts — P0-1 / R06
 * Verifies that all in-memory fallbacks fail fast in production or when demo mode is off.
 */
import { describe, expect, it, afterEach } from "vitest";
import { InMemoryGuard } from "@mosaix/support";

// Citadelle
import { InMemoryTokenStore } from "../../apps/citadelle/src/infrastructure/in-memory-token-store.js";
import { InMemorySessionStore } from "../../apps/citadelle/src/infrastructure/in-memory-session-store.js";
import { InMemoryIdentityStore } from "../../apps/citadelle/src/infrastructure/in-memory-identity-store.js";
import { InMemoryCredentialStore } from "../../apps/citadelle/src/infrastructure/in-memory-credential-store.js";

// Portfolio
import { InMemoryVendableRepository } from "../../apps/portfolio/src/infrastructure/in-memory-vendable-repository.js";
import { InMemoryProposalRepository } from "../../apps/portfolio/src/infrastructure/in-memory-proposal-repository.js";

// Theme
import { InMemoryThemeAssignmentsStore } from "../../packages/theme/src/in-memory-theme-assignments-store.js";

// Core
import { InMemoryPlatformSettingsStore } from "../../packages/core/src/platform-settings.js";

describe("Production Guarding — All In-Memory Fallbacks (P0-1 / R06)", () => {
  const envOriginal = { ...process.env };

  afterEach(() => {
    process.env = { ...envOriginal };
  });

  it("fails fast in production mode (NODE_ENV=production) for all guarded adapters", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_IN_MEMORY_IN_PRODUCTION;

    expect(() => new InMemoryTokenStore()).toThrow(/ProductionInvariantViolation/);
    expect(() => new InMemorySessionStore()).toThrow(/ProductionInvariantViolation/);
    expect(() => new InMemoryIdentityStore()).toThrow(/ProductionInvariantViolation/);
    expect(() => new InMemoryCredentialStore()).toThrow(/ProductionInvariantViolation/);
    expect(() => new InMemoryVendableRepository()).toThrow(/ProductionInvariantViolation/);
    expect(() => new InMemoryProposalRepository()).toThrow(/ProductionInvariantViolation/);
    expect(() => new InMemoryThemeAssignmentsStore()).toThrow(/ProductionInvariantViolation/);
    expect(() => new InMemoryPlatformSettingsStore()).toThrow(/ProductionInvariantViolation/);
  });

  it("fails fast when demo mode is explicitly disabled (MOSAIX_DEMO_USERS=false)", () => {
    process.env.NODE_ENV = "development";
    process.env.MOSAIX_DEMO_USERS = "false";
    delete process.env.ALLOW_IN_MEMORY_IN_PRODUCTION;

    expect(() => new InMemoryTokenStore()).toThrow(/ProductionInvariantViolation/);
    expect(() => new InMemorySessionStore()).toThrow(/ProductionInvariantViolation/);
  });

  it("allows instantiation in development mode when demo mode is enabled", () => {
    process.env.NODE_ENV = "development";
    process.env.MOSAIX_DEMO_USERS = "true";

    expect(() => new InMemoryTokenStore()).not.toThrow();
    expect(() => new InMemorySessionStore()).not.toThrow();
    expect(() => new InMemoryIdentityStore()).not.toThrow();
    expect(() => new InMemoryCredentialStore()).not.toThrow();
    expect(() => new InMemoryVendableRepository()).not.toThrow();
    expect(() => new InMemoryProposalRepository()).not.toThrow();
    expect(() => new InMemoryThemeAssignmentsStore()).not.toThrow();
    expect(() => new InMemoryPlatformSettingsStore()).not.toThrow();
  });
});
