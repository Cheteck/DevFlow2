/**
 * scripts/migration-checksums.ts — build-time checksum of migration modules.
 *
 * The migration engine only accepts TypeScript native migrations, whose
 * effective content is the module source code. The checksum recorded in the
 * ledger must therefore cover that source — not a SQL string that no longer
 * exists, and never `Function.toString()` (not stable across transpilation).
 *
 * This script computes a deterministic SHA-256 over the normalized source of
 * every migration module (and of its local dependencies), and writes it in
 * the canonical checksum block:
 *
 * ```ts
 * /* checksum:begin *\/
 * export const MIGRATION_CHECKSUM = "…64 hex…";
 * /* checksum:end *\/
 * ```
 *
 * Usage:
 * - `pnpm migration:checksums` → recompute and rewrite every checksum block.
 * - `pnpm migration:checksums -- --check` → verify only (exit 1 on drift),
 *   the mode used by CI.
 */

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  computeSourceChecksum,
  readSourceChecksum,
  withSourceChecksum,
} from "../packages/migrations/src/source-checksum.js";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const SCAN_ROOTS = ["apps", "src", "packages"] as const;
const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  ".mosaix",
  "coverage",
  "build",
  ".git",
]);

/** Recursively lists the TypeScript files of a directory. */
function listTypeScriptFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      out.push(...listTypeScriptFiles(join(dir, entry.name)));
      continue;
    }
    if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".d.ts")
    ) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

/**
 * A migration module declares its checksum with a canonical block on its own
 * line. The marker is searched as a standalone line so that the tooling
 * source itself (which documents the marker) is never treated as a
 * migration.
 */
const CHECKSUM_BLOCK_PATTERN = /^\/\* checksum:begin \*\/$/m;

/** Every file of the repository that declares a checksum block. */
function findMigrationModules(): string[] {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) {
    const dir = join(REPO_ROOT, root);
    if (!existsSync(dir)) continue;
    for (const file of listTypeScriptFiles(dir)) {
      const source = readFileSync(file, "utf-8");
      if (CHECKSUM_BLOCK_PATTERN.test(source)) {
        files.push(file);
      }
    }
  }
  return files.sort();
}

/**
 * Local dependencies of a migration module: the relative imports it
 * declares, resolved to their `.ts` file.
 *
 * Only local files are collected — the workspace packages are versioned by
 * the lockfile, not by the migration content.
 */
function localDependencies(file: string): string[] {
  const source = readFileSync(file, "utf-8");
  const specifiers = new Set<string>();
  const importPattern = /from\s+["'](\.[^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = importPattern.exec(source)) !== null) {
    specifiers.add(match[1]!);
  }

  const deps: string[] = [];
  for (const specifier of specifiers) {
    const base = resolve(dirname(file), specifier);
    const candidate = base.endsWith(".js")
      ? `${base.slice(0, -3)}.ts`
      : `${base}.ts`;
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      deps.push(candidate);
    }
  }
  return deps.sort();
}

/**
 * Sources hashed for a migration module: its local dependencies (depth
 * first) and the module itself.
 */
function checksumSources(file: string): string[] {
  const sources: string[] = [];
  const visited = new Set<string>();

  const collect = (current: string): void => {
    if (visited.has(current)) return;
    visited.add(current);
    for (const dep of localDependencies(current)) {
      collect(dep);
    }
    sources.push(readFileSync(current, "utf-8"));
  };

  collect(file);
  return sources;
}

function main(): void {
  const check = process.argv.includes("--check");
  const files = findMigrationModules();

  if (files.length === 0) {
    console.log("[migration-checksums] no migration module found.");
    return;
  }

  let drifted = 0;
  for (const file of files) {
    const source = readFileSync(file, "utf-8");
    const expected = computeSourceChecksum(checksumSources(file));
    const declared = readSourceChecksum(source);

    if (declared === expected) {
      continue;
    }

    if (check) {
      drifted += 1;
      console.error(
        `[migration-checksums] ${relative(REPO_ROOT, file)}: checksum drift ` +
          `(declared ${declared ?? "<none>"}, expected ${expected}). ` +
          `Run \`pnpm migration:checksums\`.`,
      );
      continue;
    }

    writeFileSync(file, withSourceChecksum(source, expected), "utf-8");
    console.log(
      `[migration-checksums] ${relative(REPO_ROOT, file)}: ${expected}`,
    );
  }

  if (check && drifted > 0) {
    process.exitCode = 1;
  }
}

main();
