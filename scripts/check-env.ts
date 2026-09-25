import * as fs from "node:fs";
import * as path from "node:path";

/**
 * pnpm check:env — keeps `.env.example` and the canonical Zod schema in sync.
 * Source of truth: packages/core/src/env/env.schema.ts (baseEnvSchema).
 * Fails on undocumented schema keys; warns on stale example keys.
 */
async function main(): Promise<void> {
  const root = process.cwd();
  const examplePath = path.join(root, ".env.example");
  const schemaPath = path.join(root, "packages/core/src/env/env.schema.ts");

  if (!fs.existsSync(examplePath)) {
    console.error("[check:env] Missing .env.example");
    process.exit(1);
  }
  const example = fs.readFileSync(examplePath, "utf-8");
  const exampleKeys = new Set(
    example
      .split("\n")
      .map((l) => l.trim())
      // Accept both active (`KEY=`) and documented-optional (`#KEY=` / `# KEY=`) entries
      .map((l) => l.replace(/^#\s?/, ""))
      .filter((l) => l.length > 0 && /^[A-Z][A-Z0-9_]*\s*=/.test(l))
      .map((l) => l.split("=")[0].trim())
      .filter(Boolean),
  );

  const schemaSrc = fs.readFileSync(schemaPath, "utf-8");
  const schemaKeys = new Set(
    [...schemaSrc.matchAll(/^\s{4}([A-Z][A-Z0-9_]+):/gm)].map((m) => m[1]),
  );

  const missing = [...schemaKeys].filter((k) => !exampleKeys.has(k));
  const stale = [...exampleKeys].filter((k) => !schemaKeys.has(k));

  if (stale.length > 0) {
    console.warn(
      `[check:env] WARN stale keys in .env.example (not in schema): ${stale.join(", ")}`,
    );
  }
  if (missing.length > 0) {
    console.error(
      `[check:env] FAIL schema keys missing from .env.example: ${missing.join(", ")}`,
    );
    process.exit(1);
  }
  console.log(
    `[check:env] OK — ${schemaKeys.size} schema keys documented in .env.example.`,
  );
}

main().catch((err) => {
  console.error("[check:env]", err);
  process.exit(1);
});
