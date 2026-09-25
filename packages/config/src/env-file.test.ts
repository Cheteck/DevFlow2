import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  parseEnvContent,
  upsertEnvKeys,
  ensureEnvFile,
  readEnvFile,
} from "./env-file";

describe("env-file", () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "mosaix-env-"));
    file = path.join(dir, ".env");
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("parses KEY=value, quotes, export prefix; ignores comments", () => {
    const values = parseEnvContent(
      `# comment\nA=1\nB="hello world"\nexport C='x#y'\nEMPTY=\n`,
    );
    expect(values).toMatchObject({
      A: "1",
      B: "hello world",
      C: "x#y",
      EMPTY: "",
    });
  });

  it("creates the file and appends missing keys", () => {
    const res = upsertEnvKeys(file, { MOSAIX_PORT: "3000" });
    expect(res.created).toBe(true);
    expect(res.updated).toEqual(["MOSAIX_PORT"]);
    expect(readEnvFile(file).MOSAIX_PORT).toBe("3000");
  });

  it("never overwrites without force, preserves comments", () => {
    fs.writeFileSync(file, "# keep me\nMOSAIX_PORT=4000\n", "utf-8");
    const res = upsertEnvKeys(file, { MOSAIX_PORT: "3000" });
    expect(res.updated).toEqual([]);
    expect(res.skipped).toEqual(["MOSAIX_PORT"]);
    expect(fs.readFileSync(file, "utf-8")).toContain("# keep me");
    const forced = upsertEnvKeys(
      file,
      { MOSAIX_PORT: "3000" },
      { force: true },
    );
    expect(forced.updated).toEqual(["MOSAIX_PORT"]);
  });

  it("fills commented placeholders in place", () => {
    fs.writeFileSync(file, "#MOSAIX_AUTH_JWT_SECRET=\n", "utf-8");
    const res = upsertEnvKeys(file, { MOSAIX_AUTH_JWT_SECRET: "abc" });
    expect(res.updated).toEqual(["MOSAIX_AUTH_JWT_SECRET"]);
    expect(fs.readFileSync(file, "utf-8")).toContain(
      "MOSAIX_AUTH_JWT_SECRET=abc",
    );
  });

  it("ensureEnvFile copies the template once", () => {
    const template = path.join(dir, ".env.example");
    fs.writeFileSync(template, "MOSAIX_PORT=3000\n", "utf-8");
    expect(ensureEnvFile(file, template)).toEqual({ created: true });
    expect(ensureEnvFile(file, template)).toEqual({ created: false });
  });
});
