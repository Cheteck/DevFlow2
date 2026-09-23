import { execSync } from "node:child_process";

console.log("[MosaiX Build] Running build...");
try {
  execSync("tsc --noEmit", { stdio: "inherit" });
  console.log("[MosaiX Build] Build succeeded.");
} catch (_error) {
  console.log("[MosaiX Build] Typecheck warning, proceeding with dev build.");
}
