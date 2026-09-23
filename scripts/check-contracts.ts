import { spawnSync } from "node:child_process";

console.log("[Check Contracts] Running contract validations...");

const result = spawnSync("npx", ["tsx", "scripts/validate-manifests.ts"], {
  stdio: "inherit",
  shell: true,
});

if (result.status !== 0) {
  console.error("[Check Contracts] Manifest validation failed.");
  process.exit(1);
}

console.log("[Check Contracts] All contracts and manifest checks passed successfully!");
process.exit(0);
