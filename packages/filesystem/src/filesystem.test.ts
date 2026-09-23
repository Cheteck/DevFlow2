import { describe, it, expect } from "vitest";
import { Filesystem } from "./filesystem";
import type { StoragePort } from "@mosaix/ports-storage";

class FakeStorageStore implements StoragePort {
  private files = new Map<string, string | Buffer>();

  async write(path: string, content: Buffer | string): Promise<void> {
    this.files.set(path, content);
  }

  async read(path: string): Promise<Buffer> {
    const val = this.files.get(path);
    if (val === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return typeof val === "string" ? Buffer.from(val) : val;
  }

  async readString(path: string): Promise<string> {
    const val = this.files.get(path);
    if (val === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return typeof val === "string" ? val : val.toString();
  }

  async delete(path: string): Promise<void> {
    this.files.delete(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }
}

describe("Developer Filesystem Manager", () => {
  it("should read and write files using put and get", async () => {
    const defaultPort = new FakeStorageStore();
    const fs = new Filesystem(defaultPort);

    await fs.put("file1.txt", "mosaix-contents");
    expect(await fs.exists("file1.txt")).toBe(true);

    expect(await fs.get("file1.txt")).toBe("mosaix-contents");

    const buf = await fs.getAsBuffer("file1.txt");
    expect(buf.toString()).toBe("mosaix-contents");

    await fs.delete("file1.txt");
    expect(await fs.exists("file1.txt")).toBe(false);
  });

  it("should support multiple configured disks", async () => {
    const publicDisk = new FakeStorageStore();
    const privateDisk = new FakeStorageStore();

    const disks = new Map<string, StoragePort>();
    disks.set("public", publicDisk);
    disks.set("private", privateDisk);

    const fs = new Filesystem(publicDisk, disks);

    // Write directly to default (which is public)
    await fs.put("avatar.png", "image-data");

    // Write to private disk
    const privateFs = fs.disk("private");
    await privateFs.put("secret.pdf", "secret-data");

    // Assert files are on separate storage disks
    expect(await fs.exists("avatar.png")).toBe(true);
    expect(await fs.exists("secret.pdf")).toBe(false);

    expect(await privateFs.exists("secret.pdf")).toBe(true);
    expect(await privateFs.exists("avatar.png")).toBe(false);
  });

  it("should throw if the disk is not configured", () => {
    const defaultPort = new FakeStorageStore();
    const fs = new Filesystem(defaultPort);

    expect(() => fs.disk("non-existent")).toThrowError(
      "The storage disk [non-existent] is not configured.",
    );
  });
});
