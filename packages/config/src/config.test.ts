import { describe, expect, it } from "vitest";
import { Config, config, createEnvHelper } from "./index";

describe("env helper", () => {
  it("parses typed values with fallback", () => {
    const customEnv = createEnvHelper({
      STR_VAL: "hello",
      NUM_VAL: "123",
      BOOL_VAL: "true",
      FLOAT_VAL: "45.67",
      ARR_VAL: "a,b,c",
      JSON_VAL: '{"key":"value"}',
      DATE_VAL: "2026-08-06T00:00:00.000Z",
    });

    expect(customEnv.string("STR_VAL")).toBe("hello");
    expect(customEnv.number("NUM_VAL")).toBe(123);
    expect(customEnv.boolean("BOOL_VAL")).toBe(true);
    expect(customEnv.float("FLOAT_VAL")).toBe(45.67);
    expect(customEnv.array("ARR_VAL")).toEqual(["a", "b", "c"]);
    expect(customEnv.json("JSON_VAL")).toEqual({ key: "value" });
    expect(customEnv.date("DATE_VAL").toISOString()).toBe(
      "2026-08-06T00:00:00.000Z",
    );
  });

  it("handles default fallback values when missing", () => {
    const customEnv = createEnvHelper({});

    expect(customEnv.string("MISSING", "default")).toBe("default");
    expect(customEnv.number("MISSING", 99)).toBe(99);
    expect(customEnv.boolean("MISSING", true)).toBe(true);
    expect(customEnv.float("MISSING", 1.23)).toBe(1.23);
  });

  it("enforces validation and constraints", () => {
    const customEnv = createEnvHelper({
      PORT: "3000",
      URL: "https://mosaix.io",
      ROLE: "admin",
      CODE: "abc-123",
    });

    expect(customEnv.required("PORT")).toBe("3000");
    expect(() => customEnv.required("MISSING")).toThrow(
      "is required but missing",
    );

    expect(customEnv.url("URL")).toBe("https://mosaix.io");
    expect(() => customEnv.url("PORT")).toThrow("is not a valid URL");

    expect(customEnv.enum("ROLE", ["admin", "user"])).toBe("admin");
    expect(() => customEnv.enum("ROLE", ["user", "guest"])).toThrow(
      "must be one of",
    );

    expect(customEnv.min("PORT", 1000)).toBe(3000);
    expect(() => customEnv.min("PORT", 5000)).toThrow("must be at least");

    expect(customEnv.max("PORT", 4000)).toBe(3000);
    expect(() => customEnv.max("PORT", 2000)).toThrow("must be at most");

    expect(customEnv.regex("CODE", /^[a-z]{3}-\d{3}$/)).toBe("abc-123");
    expect(() => customEnv.regex("CODE", /^\d{3}$/)).toThrow(
      "does not match pattern",
    );
  });
});

describe("Config manager", () => {
  it("loads config, retrieves dotted values, and verifies existence", async () => {
    await Config.load({
      app: {
        name: "MosaiX",
        port: 3000,
      },
      db: {
        connections: {
          mysql: {
            host: "localhost",
          },
        },
      },
    });

    expect(Config.get("app.name")).toBe("MosaiX");
    expect(Config.get("db.connections.mysql.host")).toBe("localhost");
    expect(Config.get("app.missing", "default")).toBe("default");
    expect(config("app.name")).toBe("MosaiX");

    expect(Config.has("app.name")).toBe(true);
    expect(Config.has("app.missing")).toBe(false);
  });

  it("guarantees immutability via Object.freeze", async () => {
    await Config.load({
      nested: {
        value: 42,
      },
    });

    const data = Config.all();
    expect(Object.isFrozen(data)).toBe(true);
    expect(Object.isFrozen(data.nested)).toBe(true);

    expect(() => {
      (data.nested as Record<string, unknown>).value = 99;
    }).toThrow();
  });

  it("extracts namespaces and captures request snapshots", async () => {
    await Config.load({
      database: {
        default: "mysql",
        connections: {
          mysql: { host: "localhost" },
        },
      },
    });

    const ns = Config.namespace("database");
    expect(ns.default).toBe("mysql");
    expect(ns.connections.mysql.host).toBe("localhost");

    const snapshot = Config.snapshot();
    expect(snapshot).toEqual(Config.all());
    snapshot.database.default = "postgres";
    expect(Config.get("database.default")).toBe("mysql");
  });

  it("supports reload and increments version with event listeners", async () => {
    const events: string[] = [];
    Config.on("beforeReload", () => events.push("beforeReload"));
    Config.on("reload", () => events.push("reload"));
    Config.on("change", () => events.push("change"));
    Config.on("loaded", () => events.push("loaded"));

    const initialVersion = Config.version;

    await Config.load({ key: "val" });
    expect(Config.version).toBe(initialVersion + 1);
    expect(events).toEqual(["loaded"]);

    await Config.reload({ key: "updated" });
    expect(Config.get("key")).toBe("updated");
    expect(Config.version).toBe(initialVersion + 2);
    expect(events).toEqual(["loaded", "beforeReload", "reload", "change"]);
  });
});
