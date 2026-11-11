/**
 * scripts/migrations/audit-tables.ts — non-regression audit of the table
 * references.
 *
 * The table argument of a schema or data statement must be a table name,
 * never a SQL fragment: a corrupted reference (`"UPDATE schema.table"`)
 * would target a table that does not exist.
 *
 * Usage: `pnpm audit:migrations` (exit code 1 on any anomaly).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";

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

const files = [...walk("apps"), ...walk("src")].filter((file) =>
  /migrations/.test(file),
);

let issues = 0;

for (const file of files) {
  const source = readFileSync(file, "utf-8");
  const re = /context\.(?:schema|data)\.([A-Za-z]+)\(\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const [, method, argument] = match;
    if (/^(UPDATE|DELETE|INSERT|ALTER|CREATE|DROP|SELECT)\b/i.test(argument)) {
      console.error(
        `[table] ${file}: ${method}("${argument}") — fragment SQL dans une référence de table.`,
      );
      issues += 1;
      continue;
    }
    if (/\s/.test(argument)) {
      console.error(
        `[table] ${file}: ${method}("${argument}") — nom de table suspect.`,
      );
      issues += 1;
    }
  }
}

console.log(
  `[table] ${files.length} fichier(s) vérifié(s), ${issues} anomalie(s).`,
);
if (issues > 0) {
  process.exitCode = 1;
}
