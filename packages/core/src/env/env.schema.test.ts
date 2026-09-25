import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { z } from "zod";
import { validateEnv, loadEnvFile } from "./env.schema";

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

  it("treats empty strings as unset (dotenv `KEY=` placeholders)", () => {
    const out = validateEnv({
      PSP_WEBHOOK_SECRET: "",
      MOSAIX_AUTH_JWT_SECRET: "",
      MOSAIX_DATABASE_URL: "",
      MOSAIX_DEMO_USERS: "",
      MOSAIX_AUTH_TOKEN_TTL: "",
    });
    expect(out.PSP_WEBHOOK_SECRET).toBeUndefined();
    expect(out.resolvedJwtSecret).toBeUndefined();
    expect(out.resolvedDatabaseUrl).toBeUndefined();
    expect(out.MOSAIX_AUTH_TOKEN_TTL).toBe(3600);
  });
});

describe("loadEnvFile (zero-dep dotenv)", () => {
  const KEYS = ["MOSAIX_TEST_A", "MOSAIX_TEST_B", "MOSAIX_TEST_C"];
  const saved = new Map<string, string | undefined>();

  afterEach(() => {
    for (const k of KEYS) {
      if (saved.get(k) === undefined) delete process.env[k];
      else process.env[k] = saved.get(k);
    }
    saved.clear();
  });

  function stash(): void {
    for (const k of KEYS) saved.set(k, process.env[k]);
  }

  function tmpRoot(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "mosaix-env-"));
  }

  it("loads keys, skips missing files, supports quotes/export/comments", () => {
    stash();
    delete process.env.MOSAIX_TEST_A;
    delete process.env.MOSAIX_TEST_B;
    delete process.env.MOSAIX_TEST_C;
    const dir = tmpRoot();
    fs.writeFileSync(
      path.join(dir, ".env"),
      [
        "# comment",
        "",
        "MOSAIX_TEST_A=hello",
        'MOSAIX_TEST_B="quoted value"',
        "export MOSAIX_TEST_C='single=with=equals'",
        "NOT_A_LINE",
      ].join("\n"),
    );
    const loaded = loadEnvFile([".env", "does-not-exist.env"], dir);
    expect(loaded).toEqual(["MOSAIX_TEST_A", "MOSAIX_TEST_B", "MOSAIX_TEST_C"]);
    expect(process.env.MOSAIX_TEST_A).toBe("hello");
    expect(process.env.MOSAIX_TEST_B).toBe("quoted value");
    expect(process.env.MOSAIX_TEST_C).toBe("single=with=equals");
  });

  it("never overwrites process.env; later files override earlier ones", () => {
    stash();
    process.env.MOSAIX_TEST_A = "shell-wins";
    delete process.env.MOSAIX_TEST_B;
    const dir = tmpRoot();
    fs.writeFileSync(
      path.join(dir, ".env"),
      "MOSAIX_TEST_A=from-file\nMOSAIX_TEST_B=base\n",
    );
    fs.writeFileSync(
      path.join(dir, ".env.local"),
      "MOSAIX_TEST_B=override\n",
    );
    loadEnvFile([".env", ".env.local"], dir);
    expect(process.env.MOSAIX_TEST_A).toBe("shell-wins");
    expect(process.env.MOSAIX_TEST_B).toBe("override");
  });
});
