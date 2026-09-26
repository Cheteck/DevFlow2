/**
 * @mosaix/conformance — integrity suite tests (fixture tree in tmpdir).
 */
import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { IntegrityConformanceSuite, type IntegrityRule } from "./integrity";

function fixtureRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mosaix-integrity-"));
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  return dir;
}

function write(root: string, rel: string, content: string): void {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf-8");
}

const CLEAN_SERVICE = `export class OrderRepository {
  constructor(private readonly db?: DatabasePort) {}
  async save(order: OrderModel): Promise<void> {
    await this.db?.execute("INSERT INTO commerce_orders (id) VALUES (?)", [order.id]);
  }
}\n`;

describe("IntegrityConformanceSuite", () => {
  let root: string;
  beforeEach(() => {
    root = fixtureRoot();
  });

  it("passes a clean tree with zero findings", () => {
    write(root, "src/service.ts", CLEAN_SERVICE);
    expect(IntegrityConformanceSuite.scan({ rootDir: root })).toEqual([]);
  });

  it("flags ad-hoc DDL outside migration providers with stable CONF-DB-001 ID and alias", () => {
    write(
      root,
      "src/repo.ts",
      `await db.execute("CREATE TABLE IF NOT EXISTS t (id TEXT)");\n`,
    );
    const findings = IntegrityConformanceSuite.scan({ rootDir: root });
    expect(findings.map((f) => f.ruleId)).toContain("CONF-DB-001");
    expect(findings.map((f) => f.alias)).toContain("no-ddl-outside-migrations");
    expect(findings[0]?.severity).toBe("error");
    expect(findings[0]?.remediation).toBeDefined();
  });

  it("allows DDL inside migration providers and engine", () => {
    write(
      root,
      "src/shell/database/core-migration.ts",
      `const UP = "CREATE TABLE foo (id TEXT)";\n`,
    );
    write(
      root,
      "packages/migrations/src/grammar.ts",
      `// CREATE TABLE compiled here\n`,
    );
    expect(IntegrityConformanceSuite.scan({ rootDir: root })).toEqual([]);
  });

  it("flags memory session stores, cleartext passwords and swallowed errors", () => {
    write(
      root,
      "src/server/routes/mobile-routes.ts",
      `const authCodes = new Map<string, Code>();\n`,
    );
    write(
      root,
      "apps/citadelle/src/wizard.ts",
      `const draft = { email, password: "" };\n`,
    );
    write(
      root,
      "src/server/routes/feed-routes.ts",
      `await db.query(sql).catch(() => null);\n`,
    );
    const findings = IntegrityConformanceSuite.scan({ rootDir: root });
    const ids = findings.map((f) => f.ruleId);
    const aliases = findings.map((f) => f.alias);
    expect(ids).toContain("CONF-SESSION-001");
    expect(aliases).toContain("no-memory-session-stores");
    expect(ids).toContain("CONF-SEC-001");
    expect(aliases).toContain("no-plaintext-password-defaults");
    expect(ids).toContain("CONF-DB-003");
    expect(aliases).toContain("no-swallowed-db-errors");
  });

  it("flags direct sqlite imports, allows adapters and seeder scripts", () => {
    write(
      root,
      "packages/adapters/database-sqlite/src/index.ts",
      `import { DatabaseSync } from "node:sqlite";\n`,
    );
    write(root, "src/hack.ts", `import { DatabaseSync } from "node:sqlite";\n`);
    write(
      root,
      "scripts/init-dev-admin.ts",
      `await db.query("SELECT id FROM identities WHERE email = ?");\n`,
    );
    const findings = IntegrityConformanceSuite.scan({ rootDir: root });
    const byFile = new Map(findings.map((f) => [f.file, f.ruleId]));
    expect(byFile.get("src/hack.ts")).toBe("CONF-DB-002");
    expect(byFile.has("scripts/init-dev-admin.ts")).toBe(false);
    expect([...byFile.keys()]).not.toContain(
      "packages/adapters/database-sqlite/src/index.ts",
    );
  });

  it("flags Math.random ids and mock defaults", () => {
    write(
      root,
      "src/shell/feed-service.ts",
      "const id = `feed_${Date.now()}_${Math.random().toString(36)}`;\n",
    );
    write(
      root,
      "packages/mobile-bridge/src/push/adapter.ts",
      "constructor(config = { isMockMode: true }) {}\n",
    );
    const findings = IntegrityConformanceSuite.scan({ rootDir: root });
    const ids = findings.map((f) => f.ruleId);
    expect(ids).toContain("CONF-ID-001");
    expect(ids).toContain("CONF-SEC-003");
  });

  it("flags direct cross-BAC imports via CONF-BOUNDARY-001", () => {
    write(
      root,
      "apps/commerce/src/domain/commerce-service.ts",
      `import { CitadelleService } from "../../citadelle/src/domain/citadelle-service";\n`,
    );
    const findings = IntegrityConformanceSuite.scan({ rootDir: root });
    expect(findings.map((f) => f.ruleId)).toContain("CONF-BOUNDARY-001");
  });

  it("supports custom rules and global allowlists", () => {
    write(root, "src/a.ts", `eval(userInput);\n`);
    const custom: IntegrityRule[] = [
      {
        id: "CONF-CUSTOM-001",
        alias: "no-eval",
        severity: "error",
        message: "no eval",
        pattern: /\beval\(/,
      },
    ];
    expect(
      IntegrityConformanceSuite.scan({ rootDir: root, rules: custom }),
    ).toHaveLength(1);
    expect(
      IntegrityConformanceSuite.scan({
        rootDir: root,
        rules: custom,
        globalAllow: ["src/a.ts"],
      }),
    ).toHaveLength(0);
  });

  it("summarizes counts by severity and rule (supports both ruleId and alias)", () => {
    write(root, "src/a.ts", `CREATE TABLE t (id TEXT);\nMath.random();\n`);
    const summary = IntegrityConformanceSuite.summarize(
      IntegrityConformanceSuite.scan({ rootDir: root }),
    );
    expect(summary.errors).toBe(1);
    expect(summary.warns).toBe(1);
    expect(summary.byRule["CONF-DB-001"]).toBe(1);
    expect(summary.byRule["no-ddl-outside-migrations"]).toBe(1);
  });

  it("generates JSON and SARIF reports", () => {
    write(root, "src/a.ts", `CREATE TABLE t (id TEXT);\n`);
    const findings = IntegrityConformanceSuite.scan({ rootDir: root });
    const jsonStr = IntegrityConformanceSuite.toJSON(findings);
    const sarifStr = IntegrityConformanceSuite.toSARIF(findings);

    expect(jsonStr).toContain("CONF-DB-001");
    expect(sarifStr).toContain("https://json.schemastore.org/sarif-2.1.0.json");
    expect(sarifStr).toContain("CONF-DB-001");
  });

  it("flags hardcoded UI sentences, skips brand names and code", () => {
    write(
      root,
      "src/shell/pages/home-page.ts",
      `<h1>Vue d'ensemble</h1>\n<span>MosaiX</span>\n<button title="Changer de thème">x</button>\n`,
    );
    write(
      root,
      "src/shell/client/shell-client-scripts.ts",
      `window.showToast('Déconnexion réussie. Redirection...', 'success');\nconst x = computeTotal(a, b);\n`,
    );
    const findings = IntegrityConformanceSuite.scan({ rootDir: root }).filter(
      (f) => f.ruleId === "CONF-I18N-001" || f.alias === "no-hardcoded-ui-text",
    );
    const excerpts = findings.map((f) => f.excerpt);
    expect(excerpts.some((e) => e.includes("Vue d'ensemble"))).toBe(true);
    expect(excerpts.some((e) => e.includes("Changer de thème"))).toBe(true);
    expect(excerpts.some((e) => e.includes("Déconnexion réussie"))).toBe(true);
    expect(excerpts.some((e) => e.includes("MosaiX"))).toBe(false);
    expect(excerpts.some((e) => e.includes("computeTotal"))).toBe(false);
    for (const f of findings) expect(f.severity).toBe("warn");
  });

  it("skips interpolation-only content without literal text", () => {
    write(
      root,
      "src/shell/pages/beam-view.ts",
      '<h4 class="x">${escapeHtml(title)}</h4>\n<p>{count} éléments</p>\n',
    );
    const findings = IntegrityConformanceSuite.scan({ rootDir: root }).filter(
      (f) => f.ruleId === "CONF-I18N-001" || f.alias === "no-hardcoded-ui-text",
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.excerpt).toContain("éléments");
  });

  it("ignores UI text outside view layers", () => {
    write(root, "src/server/routes/api.ts", `<h1>Vue d'ensemble</h1>\n`);
    const findings = IntegrityConformanceSuite.scan({ rootDir: root }).filter(
      (f) => f.ruleId === "CONF-I18N-001" || f.alias === "no-hardcoded-ui-text",
    );
    expect(findings).toHaveLength(0);
  });
});
