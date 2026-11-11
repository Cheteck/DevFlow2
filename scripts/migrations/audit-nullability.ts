/**
 * scripts/migrations/audit-nullability.ts — non-regression audit of the
 * column nullability.
 *
 * The DSL renders `NOT NULL` by default (the Laravel convention): a column
 * that the historical SQL leaves nullable must be marked `.nullable()`
 * explicitly. A mismatch means the generated schema is *stricter* than the
 * deployed one — an INSERT that used to succeed would be rejected.
 *
 * The audit compares the historical SQL (git HEAD) with the TypeScript
 * native migration, column by column.
 *
 * Usage: `pnpm audit:migrations` (exit code 1 on any divergence).
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { HISTORICAL_REF } from "./historical-ref.js";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".ts") && !full.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

/** Splits a parenthesised body on its top-level commas. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";
  for (const char of body) {
    if (quote !== null) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim().length > 0) parts.push(current.trim());
  return parts;
}

/** The historical source of a migration (it may have been split). */
function historicalSource(file: string): string {
  const candidates = [file];
  if (file.endsWith("create_core_tables.ts")) {
    candidates.push("src/shell/database/core-migration.ts");
  }
  for (const candidate of candidates) {
    try {
      // The stderr of `git show` is silenced: a file that does not exist in
      // the historical revision is not an error.
      return execSync(`git show ${HISTORICAL_REF}:${candidate}`, {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      continue;
    }
  }
  return "";
}

/** The historical columns and their nullability. */
function historicalColumns(source: string): {
  readonly table: string;
  readonly column: string;
  readonly notNull: boolean;
}[] {
  const out: {
    table: string;
    column: string;
    notNull: boolean;
  }[] = [];

  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\s\S]*?)\(/gi;
  let match: RegExpExecArray | null;
  while ((match = createRe.exec(source)) !== null) {
    const table = match[1]!.trim().replace(/"/g, "").split(".").pop()!;
    const open = match.index + match[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = open; i < source.length; i++) {
      if (source[i] === "(") depth += 1;
      if (source[i] === ")") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) continue;
    for (const part of splitTopLevel(source.slice(open + 1, end))) {
      if (/^(CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN)\b/i.test(part)) continue;
      const name = /^"([^"]+)"|^([A-Za-z_][A-Za-z0-9_]*)/.exec(part);
      if (!name) continue;
      const column = name[1] ?? name[2]!;
      const notNull = /NOT\s+NULL/i.test(part) || /PRIMARY\s+KEY/i.test(part);
      out.push({ table, column, notNull });
    }
  }

  const addRe =
    /ALTER\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\s\S]*?)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([\s\S]*?)(?:;|\n)/gi;
  while ((match = addRe.exec(source)) !== null) {
    const table = match[1]!.trim().replace(/"/g, "").split(".").pop()!;
    const definition = match[2]!.trim();
    const name = /^"([^"]+)"|^([A-Za-z_][A-Za-z0-9_]*)/.exec(definition);
    if (!name) continue;
    const column = name[1] ?? name[2]!;
    const notNull =
      /NOT\s+NULL/i.test(definition) || /PRIMARY\s+KEY/i.test(definition);
    out.push({ table, column, notNull });
  }

  return out;
}

/** The DSL columns declared for a table. */
function dslColumns(
  source: string,
): Map<string, { nullable: boolean; primary: boolean }> {
  const out = new Map<string, { nullable: boolean; primary: boolean }>();

  const createRe =
    /context\.schema\.createTable\(\s*(?:"([^"]+)"|\{[^}]*name:\s*"([^"]+)"[^}]*\})\s*,\s*\(table\)\s*=>\s*\{([\s\S]*?)\n\s*\}\s*,\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = createRe.exec(source)) !== null) {
    const table = match[1] ?? match[2]!;
    const body = match[3]!;
    const columnRe = /table\.([A-Za-z]+)\(\s*"([^"]+)"([^)]*)\)([^;\n]*);/g;
    let columnMatch: RegExpExecArray | null;
    while ((columnMatch = columnRe.exec(body)) !== null) {
      const modifiers = `${columnMatch[3] ?? ""}${columnMatch[4] ?? ""}`;
      out.set(`${table}.${columnMatch[2]!}`, {
        nullable:
          /\.nullable\(\)/.test(modifiers) && !/\.primary\(\)/.test(modifiers),
        primary: /\.primary\(\)/.test(modifiers),
      });
    }
  }

  const addRe =
    /context\.schema\.addColumn\(\s*(?:"([^"]+)"|\{[^}]*name:\s*"([^"]+)"[^}]*\})\s*,\s*"([^"]+)"\s*,\s*"[^"]+"\s*,\s*(?:\(col\)\s*=>\s*\{([\s\S]*?)\n\s*\}|undefined)/g;
  while ((match = addRe.exec(source)) !== null) {
    const table = match[1] ?? match[2]!;
    const modifiers = match[4] ?? "";
    out.set(`${table}.${match[3]!}`, {
      nullable:
        /\.nullable\(\)/.test(modifiers) && !/\.primary\(\)/.test(modifiers),
      primary: /\.primary\(\)/.test(modifiers),
    });
  }

  return out;
}

const files = [...walk("apps"), ...walk("src")].filter((file) =>
  /migrations/.test(file),
);

let checked = 0;
let mismatches = 0;

for (const file of files) {
  const historical = historicalSource(file);
  if (historical.length === 0) continue;
  const current = readFileSync(file, "utf-8");
  const expected = historicalColumns(historical);
  if (expected.length === 0) continue;
  const actual = dslColumns(current);
  if (actual.size === 0) continue;
  checked += 1;

  for (const column of expected) {
    const key = `${column.table}.${column.column}`;
    const found = actual.get(key);
    if (!found) continue;
    if (found.nullable === column.notNull) {
      console.error(
        `[nullabilité] ${file}: ${key} — historique ${
          column.notNull ? "NOT NULL" : "nullable"
        }, DSL ${found.nullable ? "nullable" : "NOT NULL"}`,
      );
      mismatches += 1;
    }
  }
}

console.log(
  `[nullabilité] ${checked} migration(s) vérifiée(s), ${mismatches} écart(s).`,
);
if (mismatches > 0) {
  process.exitCode = 1;
}
