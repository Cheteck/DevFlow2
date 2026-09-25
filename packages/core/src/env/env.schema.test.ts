import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateEnv } from "./env.schema";

describe("validateEnv (canonical + aliases, extensible)", () => {
  it("defaults port to 3000 on empty env", () => {
    expect(validateEnv({}).resolvedPort).toBe(3000);
  });

  it("canonical MOSAIX_PORT wins over legacy aliases", () => {
    const out = validateEnv({
      MOSAIX_PORT: "4001",
      APP_PORT: "4002",
      PORT: "4003",
    });
    expect(out.resolvedPort).toBe(4001);
    expect(out.usedLegacyAliases).toEqual([]);
  });

  it("falls back to legacy APP_PORT/PORT with warning list", () => {
    expect(validateEnv({ APP_PORT: "4002" }).resolvedPort).toBe(4002);
    expect(validateEnv({ PORT: "4003" }).resolvedPort).toBe(4003);
  });

  it("resolves database/redis/jwt with canonical-first order", () => {
    const out = validateEnv({
      MOSAIX_DATABASE_URL: "postgres://a",
      DATABASE_URL: "postgres://b",
      REDIS_URL: "redis://b",
      JWT_SECRET: "1234567890123456",
    });
    expect(out.resolvedDatabaseUrl).toBe("postgres://a");
    expect(out.resolvedRedisUrl).toBe("redis://b");
    expect(out.resolvedJwtSecret).toBe("1234567890123456");
  });

  it("extends without editing the canonical file", () => {
    const out = validateEnv(
      { MY_BAC_KEY: "hello" },
      z.object({ MY_BAC_KEY: z.string() }),
    );
    expect((out as Record<string, unknown>).MY_BAC_KEY).toBe("hello");
  });

  it("throws fail-fast on invalid port", () => {
    expect(() => validateEnv({ MOSAIX_PORT: "not-a-port" })).toThrow(
      /Invalid environment/,
    );
  });
});
