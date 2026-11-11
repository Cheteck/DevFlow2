import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

try {
  const statusOutput = execSync("git status --porcelain", { encoding: "utf8" });
  const lines = statusOutput
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);

  const filesToCheck: string[] = [];

  for (const line of lines) {
    if (line.length < 4) continue;
    const status = line.substring(0, 2);
    // Ignore deleted
    if (status.includes("D")) continue;

    let filePath = line.substring(3).trim();
    // Handle quoted paths if any
    if (filePath.startsWith('"') && filePath.endsWith('"')) {
      filePath = filePath.slice(1, -1);
    }

    // Filter out untracked temporary artifacts or files that don't exist
    if (
      existsSync(filePath) &&
      /\.(ts|tsx|js|jsx|mjs|json|md|html|css|yml|yaml)$/.test(filePath) &&
      !filePath.startsWith("node_modules/") &&
      !filePath.startsWith(".mosaix/") &&
      !filePath.endsWith("code.html") &&
      !filePath.endsWith("fix-esm-imports.mjs")
    ) {
      filesToCheck.push(filePath);
    }
  }

  if (filesToCheck.length === 0) {
    console.log(
      "✅ Check format (Option A): No staged/modified code files to check.",
    );
    process.exit(0);
  }

  console.log(
    `🔍 Checking Prettier format on ${filesToCheck.length} modified/staged file(s)...`,
  );
  const filesList = filesToCheck.map((f) => `"${f}"`).join(" ");
  execSync(`pnpm exec prettier --check ${filesList}`, { stdio: "inherit" });
  console.log("✅ Check format passed for modified files.");
} catch (_error) {
  console.error("❌ Prettier format check failed on modified files.");
  process.exit(1);
}
