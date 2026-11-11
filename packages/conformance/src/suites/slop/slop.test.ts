import { describe, expect, it } from "vitest";
import { SLOP_RULES } from "./rules.js";
import { scanSlop } from "./scanner.js";
import { loadSlopConfig } from "./config.js";
import { resolveScopeFiles } from "./scope.js";

describe("Slop Checker Suite (PRD-0012)", () => {
  describe("Rule Catalogue & Pattern Matching", () => {
    it("SLOP-P0-01 (no-math-random) detects Math.random() usage", () => {
      const rule = SLOP_RULES.find((r) => r.id === "SLOP-P0-01")!;
      expect(rule.pattern.test("const id = Math.random();")).toBe(true);
      expect(rule.pattern.test("const id = crypto.randomUUID();")).toBe(false);
    });

    it("SLOP-P0-02 (no-untracked-todo) enforces tracked TODO policy", () => {
      const rule = SLOP_RULES.find((r) => r.id === "SLOP-P0-02")!;

      // Bare TODO -> triggers rule
      const bareLine = "// TODO fix this bug later";
      const bareMatch = rule.pattern.exec(bareLine);
      expect(bareMatch).not.toBeNull();
      expect(rule.refine!(bareLine, bareMatch!)).toBe(true);

      // Tracked TODO with issue #123 -> allowed
      const trackedLine1 = "// TODO(#123): fix this bug";
      const match1 = rule.pattern.exec(trackedLine1);
      expect(rule.refine!(trackedLine1, match1!)).toBe(false);

      // Tracked TODO with ticket MOSAIX-456 -> allowed
      const trackedLine2 = "// TODO(MOSAIX-456): implement feature";
      const match2 = rule.pattern.exec(trackedLine2);
      expect(rule.refine!(trackedLine2, match2!)).toBe(false);

      // Tracked TODO with date 2026-10-15 -> allowed
      const trackedLine3 = "// FIXME(2026-10-15): temporary workaround";
      const match3 = rule.pattern.exec(trackedLine3);
      expect(rule.refine!(trackedLine3, match3!)).toBe(false);
    });

    it("SLOP-P0-03 (no-unimplemented) detects 'not implemented' throw stubs", () => {
      const rule = SLOP_RULES.find((r) => r.id === "SLOP-P0-03")!;
      expect(rule.pattern.test("throw new Error('Not implemented yet');")).toBe(
        true,
      );
      expect(
        rule.pattern.test("throw new Error('Invalid input payload');"),
      ).toBe(false);
    });

    it("SLOP-P0-04 (no-console) detects console.log and ignores comments", () => {
      const rule = SLOP_RULES.find((r) => r.id === "SLOP-P0-04")!;

      const logLine = "console.log('debug output');";
      const match1 = rule.pattern.exec(logLine);
      expect(match1).not.toBeNull();
      expect(rule.refine!(logLine, match1!)).toBe(true);

      const commentLine = "// console.log('commented log')";
      const match2 = rule.pattern.exec(commentLine);
      expect(rule.refine!(commentLine, match2!)).toBe(false);
    });

    it("SLOP-P0-05 (no-alert) detects browser alert() call", () => {
      const rule = SLOP_RULES.find((r) => r.id === "SLOP-P0-05")!;
      expect(rule.pattern.test("alert('Hello world');")).toBe(true);
      expect(rule.pattern.test("showToast('Hello world');")).toBe(false);
    });

    it("SLOP-P0-06 (no-empty-catch) detects empty catch blocks", () => {
      const rule = SLOP_RULES.find((r) => r.id === "SLOP-P0-06")!;
      expect(rule.pattern.test("try { doWork(); } catch (err) {}")).toBe(true);
      expect(
        rule.pattern.test(
          "try { doWork(); } catch (err) { console.error(err); }",
        ),
      ).toBe(false);
    });

    it("SLOP-P0-07 (no-ts-ignore) detects bare @ts-ignore without comment", () => {
      const rule = SLOP_RULES.find((r) => r.id === "SLOP-P0-07")!;

      const bareLine = "// @ts-ignore";
      const match1 = rule.pattern.exec(bareLine);
      expect(rule.refine!(bareLine, match1!)).toBe(true);

      const documentedLine = "// @ts-expect-error: legacy port compatibility";
      const match2 = rule.pattern.exec(documentedLine);
      expect(rule.refine!(documentedLine, match2!)).toBe(false);
    });
  });

  describe("Config & Scope Resolution", () => {
    it("resolves code scope files excluding tests and archive", () => {
      const files = resolveScopeFiles({ scopes: ["code"] });
      expect(files.length).toBeGreaterThan(0);
      expect(files.every((f) => f.endsWith(".ts") || f.endsWith(".tsx"))).toBe(
        true,
      );
      expect(files.some((f) => f.endsWith(".test.ts"))).toBe(false);
    });

    it("loads default configuration when .slop.json is missing or uses root config", () => {
      const config = loadSlopConfig();
      expect(config.version).toBe(1);
      expect(config.rules.length).toBeGreaterThan(0);
    });

    it("scans and produces deterministic JSON report with fingerprint", () => {
      const report = scanSlop({ scopes: ["code"] });
      expect(report.version).toBe(1);
      expect(report.summary.totalFilesAnalyzed).toBeGreaterThan(0);
      expect(Array.isArray(report.findings)).toBe(true);

      if (report.findings.length > 0) {
        const first = report.findings[0];
        expect(first.ruleId).toBeDefined();
        expect(first.fingerprint).toBeDefined();
        expect(first.fingerprint.length).toBe(16);
      }
    });
  });
});
