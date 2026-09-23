import {
  type Migration,
  type MigrationProvider,
  computeChecksum
} from "./registry.js";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * FileMigrationProvider scans a directory for files named
 * YYYYMMDDHHMMSS_name.ts and parses SQL definitions or content.
 */
export class FileMigrationProvider implements MigrationProvider {
  constructor(
    private readonly _ownerId: string,
    private readonly directory: string
  ) {}

  ownerId(): string {
    return this._ownerId;
  }

  migrations(): readonly Migration[] {
    if (!fs.existsSync(this.directory)) {
      return [];
    }

    const files = fs
      .readdirSync(this.directory)
      .filter((file) => file.endsWith(".ts") || file.endsWith(".sql"))
      .sort();

    return files.map((file) => {
      const filePath = path.join(this.directory, file);
      const rawContent = fs.readFileSync(filePath, "utf-8");
      
      return {
        id: file.replace(/\.(ts|sql)$/, ""),
        content: rawContent,
        checksum: computeChecksum(rawContent),
        resources: [`migration:${file.replace(/\.(ts|sql)$/, "")}`],
      };
    });
  }
}
