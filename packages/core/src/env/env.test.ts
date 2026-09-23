import { describe, it, expect, beforeEach } from "vitest";
import { EnvManager } from "./env";
import { z } from "zod";

describe("EnvManager", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("should retrieve values with fallback", () => {
    process.env.PORT = "4000";
    const env = new EnvManager();
    expect(env.number("PORT")).toBe(4000);
    expect(env.string("MISSING", "default-val")).toBe("default-val");
  });

  it("should validate against Zod schema (fail-fast)", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_PORT = "8080";

    const env = new EnvManager();
    const schema = z.object({
      NODE_ENV: z.string(),
      APP_PORT: z.string(),
    });

    const parsed = env.validate(schema);
    expect(parsed.NODE_ENV).toBe("production");
    expect(env.number("APP_PORT")).toBe(8080);
  });

  it("should throw on invalid validation", () => {
    delete process.env.REQUIRED_VAR;
    const env = new EnvManager();
    const schema = z.object({
      REQUIRED_VAR: z.string(),
    });

    expect(() => env.validate(schema)).toThrowError(/Environment variable validation failed/);
  });
});
