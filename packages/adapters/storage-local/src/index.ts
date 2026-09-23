import { writeFile, readFile, rm, access, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { StoragePort } from "@mosaix/ports-storage";

export class LocalStorageAdapter implements StoragePort {
  constructor(private readonly baseDir: string) {}

  private getFullPath(path: string): string {
    return join(this.baseDir, path);
  }

  async write(path: string, content: Buffer | string): Promise<void> {
    const fullPath = this.getFullPath(path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content);
  }

  async read(path: string): Promise<Buffer> {
    const fullPath = this.getFullPath(path);
    return await readFile(fullPath);
  }

  async readString(path: string): Promise<string> {
    const fullPath = this.getFullPath(path);
    return await readFile(fullPath, "utf-8");
  }

  async delete(path: string): Promise<void> {
    const fullPath = this.getFullPath(path);
    await rm(fullPath, { force: true });
  }

  async exists(path: string): Promise<boolean> {
    const fullPath = this.getFullPath(path);
    try {
      await access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
