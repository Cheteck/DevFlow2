/**
 * @mosaix/conformance — Slop Checker Scope Resolver (PRD-0012)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { globMatch, isAlwaysSkipped, toPosix } from "../integrity/allowlist.js";

export type SlopScopeName = "code" | "docs" | "diff";

export interface SlopScopeOptions {
  rootDir?: string;
  scopes?: SlopScopeName[];
  base?: string;
}

export class SlopExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlopExecutionError";
  }
}

export const CODE_INCLUDES = [
  "src/**/*.ts",
  "src/**/*.tsx",
  "apps/**/*.ts",
  "apps/**/*.tsx",
  "packages/**/*.ts",
  "packages/**/*.tsx",
  "scripts/**/*.ts",
];

export const DOCS_INCLUDES = [
  "**/*.md",
];

export function getGitDiffFiles(rootDir: string, baseRef: string = "origin/main"): string[] {
  try {
    const output = execSync(`git diff --name-only ${baseRef}`, {
      cwd: rootDir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0 && fs.existsSync(path.join(rootDir, f)));
  } catch (err) {
    throw new SlopExecutionError(
      `Git diff resolution failed against base '${baseRef}': ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export function resolveScopeFiles(options: SlopScopeOptions = {}): string[] {
  const rootDir = options.rootDir ?? process.cwd();
  const requestedScopes = options.scopes ?? ["code"];
  const baseRef = options.base ?? "origin/main";

  let candidates: string[] = [];

  const isCode = requestedScopes.includes("code");
  const isDocs = requestedScopes.includes("docs");
  const isDiff = requestedScopes.includes("diff");

  // Collect files across root
  const allFiles: string[] = [];
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name === "node_modules" ||
          entry.name === "dist" ||
          entry.name === "build" ||
          entry.name === ".git"
        ) {
          continue;
        }
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const rel = toPosix(path.relative(rootDir, full));
      if (isAlwaysSkipped(rel)) continue;
      allFiles.push(rel);
    }
  };

  walk(rootDir);

  if (isCode || isDocs) {
    candidates = allFiles.filter((rel) => {
      let codeMatch = false;
      let docsMatch = false;

      if (isCode) {
        codeMatch = CODE_INCLUDES.some((glob) => globMatch(glob, rel));
        // Exclude test files for code scope
        if (rel.endsWith(".test.ts") || rel.endsWith(".spec.ts") || rel.includes("/tests/")) {
          codeMatch = false;
        }
      }

      if (isDocs) {
        docsMatch = DOCS_INCLUDES.some((glob) => globMatch(glob, rel));
        if (rel.startsWith(".project/archive/")) {
          docsMatch = false;
        }
      }

      return codeMatch || docsMatch;
    });
  }

  if (isDiff) {
    const diffFiles = getGitDiffFiles(rootDir, baseRef);
    if (requestedScopes.length === 1 && isDiff) {
      candidates = diffFiles;
    } else {
      // Intersection: filter candidates to only those present in diff
      const diffSet = new Set(diffFiles.map((f) => toPosix(f)));
      candidates = candidates.filter((f) => diffSet.has(toPosix(f)));
    }
  }

  return Array.from(new Set(candidates)).sort();
}
