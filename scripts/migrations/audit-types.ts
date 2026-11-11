/**
 * scripts/migrations/audit-types.ts — non-regression audit of the column
 * types.
 *
 * A type divergence is a schema change on the deployed database: the audit
 * compares the type declared by the historical SQL with the type declared
 * by the TypeScript native migration, column by column.
 *
 * The `ALTER COLUMN … TYPE` statements have the last word on the type of a
 * column: the `CREATE TABLE` type is the historical one, the alteration is
 * what the deployed database actually has.
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

/** The canonical type of a historical SQL type. */
function canonicalType(sqlType: string): string {
  const type = sqlType.trim().toUpperCase().replace(/\s+/g, " ");
  if (type.startsWith("VARCHAR")) return "STRING";
  if (type.startsWith("TEXT")) return "TEXT";
  if (type.startsWith("TIMESTAMPTZ")) return "TIMESTAMP";
  if (type.startsWith("TIMESTAMP")) return "TIMESTAMP";
  if (type.startsWith("BIGINT")) return "BIGINT";
  if (type.startsWith("INT")) return "INTEGER";
  if (type.startsWith("BOOL")) return "BOOLEAN";
  if (type.startsWith("JSONB") || type.startsWith("JSON")) return "JSON";
  if (type.startsWith("DOUBLE") || type.startsWith("REAL")) return "REAL";
  if (type.startsWith("NUMERIC") || type.startsWith("DECIMAL"))
    return "DECIMAL";
  if (type.startsWith("UUID")) return "UUID";
  return type;
}

/** The canonical type of a DSL type. */
function dslType(method: string): string {
  switch (method) {
    case "string":
      return "STRING";
    case "text":
      return "TEXT";
    case "integer":
      return "INTEGER";
    case "bigInteger":
      return "BIGINT";
    case "decimal":
      return "DECIMAL";
    case "real":
      return "REAL";
    case "uuid":
      return "UUID";
    case "timestamp":
    case "timestampWithoutTimeZone":
      return "TIMESTAMP";
    case "json":
      return "JSON";
    case "boolean":
      return "BOOLEAN";
    default:
      return method;
  }
}

const files = [...walk("apps"), ...walk("src")].filter((file) =>
  /migrations/.test(file),
);

let compared = 0;
let issues = 0;

for (const file of files) {
  let historical: string;
  try {
    historical = execSync(`git show ${HISTORICAL_REF}:${file}`, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    continue;
  }
  const current = readFileSync(file, "utf-8");

  const dslCreateTable = (table: string): Map<string, string> => {
    const out = new Map<string, string>();
    const re = new RegExp(
      `createTable\\(\\s*(?:\\{[^}]*name:\\s*"${table}"[^}]*\\}|"${table}")\\s*,\\s*\\(table\\)\\s*=>\\s*\\{([\\s\\S]*?)\\n\\s*\\}\\s*,\\s*\\{`,
    );
    const call = re.exec(current);
    if (!call) return out;
    const columnRe = /table\.([A-Za-z]+)\(\s*"([^"]+)"/g;
    let columnMatch: RegExpExecArray | null;
    while ((columnMatch = columnRe.exec(call[1]!)) !== null) {
      out.set(columnMatch[2]!, dslType(columnMatch[1]!));
    }
    return out;
  };

  const dslAddColumn = (table: string, column: string): string | undefined => {
    const re = new RegExp(
      `addColumn\\(\\s*(?:\\{[^}]*name:\\s*"${table}"[^}]*\\}|"${table}")\\s*,\\s*"${column}"\\s*,\\s*"([A-Za-z]+)"`,
    );
    const call = re.exec(current);
    return call ? dslType(call[1]!) : undefined;
  };

  // The `ALTER COLUMN … TYPE` statements have the last word.
  const alteredTypes = new Map<string, string>();
  const alterRe =
    /ALTER\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\s\S]*?)\s+ALTER\s+COLUMN\s+([\s\S]*?)\s+TYPE\s+([\s\S]*?)(?:;|\n)/gi;
  let alterMatch: RegExpExecArray | null;
  while ((alterMatch = alterRe.exec(historical)) !== null) {
    const table = alterMatch[1]!.trim().replace(/"/g, "").split(".").pop()!;
    const column = alterMatch[2]!.trim().replace(/"/g, "").split(".").pop()!;
    alteredTypes.set(`${table}.${column}`, canonicalType(alterMatch[3]!));
  }

  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\s\S]*?)\(/gi;
  let match: RegExpExecArray | null;
  while ((match = createRe.exec(historical)) !== null) {
    const table = match[1]!.trim().replace(/"/g, "").split(".").pop()!;
    const open = match.index + match[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = open; i < historical.length; i++) {
      if (historical[i] === "(") depth += 1;
      if (historical[i] === ")") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) continue;
    const dsl = dslCreateTable(table);
    if (dsl.size === 0) continue;
    for (const part of splitTopLevel(historical.slice(open + 1, end))) {
      if (/^(CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN)\b/i.test(part)) continue;
      const nameMatch = /^"([^"]+)"|^([A-Za-z_][A-Za-z0-9_]*)/.exec(part);
      if (!nameMatch) continue;
      const column = nameMatch[1] ?? nameMatch[2]!;
      const rest = part.slice(nameMatch[0].length).trim();
      const typeMatch = /^([A-Za-z][A-Za-z0-9 ]*(?:\(\d+\))?)/.exec(rest);
      if (!typeMatch) continue;
      const got = dsl.get(column);
      if (got === undefined) continue;
      const key = `${table}.${column}`;
      compared += 1;
      const expected = alteredTypes.get(key) ?? canonicalType(typeMatch[1]!);
      if (got !== expected) {
        console.error(
          `[type] ${file}: ${key} — historique ${expected}, DSL ${got}`,
        );
        issues += 1;
      }
    }
  }

  const addRe =
    /ALTER\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\s\S]*?)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([\s\S]*?)(?:;|\n)/gi;
  while ((match = addRe.exec(historical)) !== null) {
    const table = match[1]!.trim().replace(/"/g, "").split(".").pop()!;
    const definition = match[2]!.trim();
    const nameMatch = /^"([^"]+)"|^([A-Za-z_][A-Za-z0-9_]*)/.exec(definition);
    if (!nameMatch) continue;
    const column = nameMatch[1] ?? nameMatch[2]!;
    const rest = definition.slice(nameMatch[0].length).trim();
    const typeMatch = /^([A-Za-z][A-Za-z0-9 ]*(?:\(\d+\))?)/.exec(rest);
    if (!typeMatch) continue;
    const got = dslAddColumn(table, column);
    if (got === undefined) continue;
    compared += 1;
    const expected = canonicalType(typeMatch[1]!);
    if (got !== expected) {
      console.error(
        `[type] ${file}: ${table}.${column} — historique ${expected}, DSL ${got}`,
      );
      issues += 1;
    }
  }
}

console.log(`[type] ${compared} colonne(s) comparée(s), ${issues} écart(s).`);
if (issues > 0) {
  process.exitCode = 1;
}
