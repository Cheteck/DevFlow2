import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { LocalStorageAdapter } from "./index";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rm, mkdir } from "node:fs/promises";

describe("LocalStorageAdapter", () => {
  const tmpBase = join(tmpdir(), "mosaix-test-storage");

  beforeAll(async () => {
    await mkdir(tmpBase, { recursive: true });
  });

  afterAll(async () => {
    await rm(tmpBase, { recursive: true, force: true });
  });

  it("can write, read, check existence, and delete files", async () => {
    const storage = new LocalStorageAdapter(tmpBase);
    const path = "nested/test.txt";

    await expect(storage.exists(path)).resolves.toBe(false);

    await storage.write(path, "Hello MosaiX");
    await expect(storage.exists(path)).resolves.toBe(true);

    const content = await storage.readString(path);
    expect(content).toBe("Hello MosaiX");

    const buffer = await storage.read(path);
    expect(buffer.toString()).toBe("Hello MosaiX");

    await storage.delete(path);
    await expect(storage.exists(path)).resolves.toBe(false);
  });
});
