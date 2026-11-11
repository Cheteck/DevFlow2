import { execSync } from "node:child_process";

console.log("[MosaiX Build] Running production build...");
try {
  execSync("tsc -p tsconfig.build.json", { stdio: "inherit" });
  console.log("[MosaiX Build] Build succeeded. Output generated in ./dist");
} catch (_error) {
  console.error("[MosaiX Build] Build failed.");
  process.exit(1);
}
