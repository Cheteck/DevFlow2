#!/usr/bin/env tsx
/**
 * @mosaix/cli — Executable entrypoint (`pnpm mosaix <command> [args]`).
 *
 * Parses argv and dispatches through `MosaixCommandRouter`. Previously the
 * root `mosaix` script pointed at the package barrel (`src/index.ts`), so
 * every invocation silently did nothing and exited 0 — migrations never ran.
 */

import { MosaixCommandRouter, EXIT_CODES } from "./command-router.js";

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;
  const router = new MosaixCommandRouter(process.cwd());

  if (!command || command === "help" || command === "--help" || command === "-h") {
    const help = await router.execute("list", { args: [] });
    process.exit(help.exitCode);
    return;
  }

  const result = await router.execute(command, {
    json: rest.includes("--json"),
    ci: rest.includes("--ci"),
    args: rest.filter((a) => a !== "--json" && a !== "--ci"),
  });
  process.exit(result.exitCode);
}

main().catch((err) => {
  console.error(
    `[mosaix] fatal: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(EXIT_CODES.GENERIC_ERROR);
});
