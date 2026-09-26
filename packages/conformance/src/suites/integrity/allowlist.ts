/**
 * @mosaix/conformance — Glob & Allowlist matching.
 */
import * as path from "node:path";
import type { IntegrityRule } from "./rules.js";

export function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/** Minimal glob matcher (`**`, `*`, `?`) over `/`-separated paths. */
export function globMatch(pattern: string, relPath: string): boolean {
  const escape = (s: string): string => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  let regex = "";
  const parts = pattern.split("**");
  parts.forEach((part, i) => {
    if (i > 0) regex += ".*";
    regex += escape(part).replace(/\\\*/g, "[^/]*").replace(/\\\?/g, "[^/]");
  });
  return new RegExp(`^${regex}$`).test(relPath);
}

export const ALWAYS_SKIP = [
  "**/node_modules/**",
  "**/dist/**",
  "**/*.test.ts",
  "**/*.spec.ts",
  // Self-hosting guard: the rule definitions contain the keywords they detect.
  "packages/conformance/src/suites/integrity.ts",
  "packages/conformance/src/suites/integrity/*.ts",
];

export function isAllowed(
  relPath: string,
  rule: IntegrityRule,
  globalAllow: string[] = []
): boolean {
  if (ALWAYS_SKIP.some((p) => globMatch(p, relPath))) return true;
  if (rule.allow && rule.allow.some((p) => globMatch(p, relPath))) return true;
  if (globalAllow.some((p) => globMatch(p, relPath))) return true;
  return false;
}
