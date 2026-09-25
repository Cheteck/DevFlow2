import * as fs from "node:fs";
import * as path from "node:path";

/**
 * @mosaix/config — `.env` file read/write preserving comments, order and
 * formatting (Laravel `key:generate` writes back to `.env` the same way).
 *
 * Rules:
 * - Existing keys are never overwritten unless `force: true`.
 * - Missing keys are appended (`KEY=value`), or inserted next to a matching
 *   commented placeholder (`#KEY=...` → replaced in place).
 * - Quoting: values with spaces / `#` / quotes are double-quoted.
 */

export interface EnvUpsertResult {
  file: string;
  created: boolean;
  updated: string[];
  skipped: string[];
}

/** Parse `KEY=value` lines (ignores comments, blanks, `export ` prefix). */
export function parseEnvContent(content: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const body = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = body.indexOf("=");
    if (eq <= 0) continue;
    const key = body.slice(0, eq).trim();
    if (!/^[A-Z][A-Z0-9_]*$/i.test(key)) continue;
    let value = body.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  return parseEnvContent(fs.readFileSync(filePath, "utf-8"));
}

function quoteIfNeeded(value: string): string {
  if (value.length === 0) return value;
  if (/[\s#"']/.test(value)) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

/**
 * Insert or update keys in a dotenv file, preserving the rest byte-for-byte.
 * Returns which keys were written vs skipped (already set and no `force`).
 */
export function upsertEnvKeys(
  filePath: string,
  entries: Record<string, string>,
  options: { force?: boolean } = {},
): EnvUpsertResult {
  const force = options.force ?? false;
  const created = !fs.existsSync(filePath);
  const raw = created ? "" : fs.readFileSync(filePath, "utf-8");
  const existing = parseEnvContent(raw);
  const lines = created ? [] : raw.split("\n");

  const updated: string[] = [];
  const skipped: string[] = [];
  const pending = new Map(Object.entries(entries));

  if (!created) {
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const uncommented = trimmed.replace(/^#\s?/, "");
      const match = uncommented.match(/^([A-Z][A-Z0-9_]*)\s*=/i);
      if (!match) continue;
      const key = match[1];
      if (!pending.has(key)) continue;
      const isCommented = trimmed.startsWith("#");
      const alreadySet = !isCommented && (existing[key] ?? "") !== "";
      if (alreadySet && !force) {
        skipped.push(key);
        pending.delete(key);
        continue;
      }
      lines[i] = `${key}=${quoteIfNeeded(pending.get(key)!)}`;
      updated.push(key);
      pending.delete(key);
    }
  }

  for (const [key, value] of pending) {
    const alreadySet = (existing[key] ?? "") !== "";
    if (alreadySet && !force) {
      skipped.push(key);
      continue;
    }
    if (lines.length > 0 && lines[lines.length - 1].trim() !== "")
      lines.push("");
    lines.push(`${key}=${quoteIfNeeded(value)}`);
    updated.push(key);
  }

  // Drop the single trailing empty line `split` artifacts into one newline.
  const out = lines.join("\n").replace(/\n{3,}/g, "\n\n");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, out.endsWith("\n") ? out : `${out}\n`, "utf-8");
  return { file: filePath, created, updated, skipped };
}

/** Copy a template (`.env.example`) to target when target is missing. */
export function ensureEnvFile(
  targetPath: string,
  templatePath?: string,
): { created: boolean } {
  if (fs.existsSync(targetPath)) return { created: false };
  if (templatePath && fs.existsSync(templatePath)) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(templatePath, targetPath);
    return { created: true };
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, "", "utf-8");
  return { created: true };
}
