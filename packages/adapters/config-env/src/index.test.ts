import { describe, expect, it } from "vitest";
import { EnvConfigAdapter } from "./index";

describe("EnvConfigAdapter", () => {
  it("resolves config from custom source or throws for required", () => {
    const custom = {
      APP_PORT: "8080",
      DB_HOST: "localhost",
    };
    const config = new EnvConfigAdapter(custom);

    expect(config.get("APP_PORT")).toBe("8080");
    expect(config.get("UNKNOWN")).toBeUndefined();

    expect(config.getOrDefault("UNKNOWN", "fallback")).toBe(
      "custom" in custom ? "fallback" : "fallback",
    );
    expect(config.getRequired("DB_HOST")).toBe("localhost");

    expect(() => config.getRequired("MISSING")).toThrow(
      /Required configuration key "MISSING" is missing/,
    );
  });
});
