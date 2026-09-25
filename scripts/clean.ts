import { MosaixFolderManager } from "../packages/cli/src/index.js";

console.log("[MosaiX Clean] Cleaning build artifacts and cache...");

const folderManager = new MosaixFolderManager(process.cwd());
folderManager.clean();

console.log("[MosaiX Clean] Workspace build artifacts cleaned successfully.");
process.exit(0);
