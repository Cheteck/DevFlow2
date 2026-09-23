import type { StoragePort } from "@mosaix/ports-storage";

export class Filesystem {
  protected defaultDisk: StoragePort;
  protected disks = new Map<string, StoragePort>();

  constructor(defaultDisk: StoragePort, disks?: Map<string, StoragePort>) {
    this.defaultDisk = defaultDisk;
    if (disks !== undefined) {
      this.disks = disks;
    }
  }

  /**
   * Access a specific named storage disk.
   */
  disk(name: string): Filesystem {
    const port = this.disks.get(name);
    if (port === undefined) {
      throw new Error(`The storage disk [${name}] is not configured.`);
    }
    // Return a new Filesystem instance configured with this specific disk.
    return new Filesystem(port, this.disks);
  }

  /**
   * Write file content.
   */
  async put(path: string, content: Buffer | string): Promise<void> {
    await this.defaultDisk.write(path, content);
  }

  /**
   * Retrieve file content as a string.
   */
  async get(path: string): Promise<string> {
    return this.defaultDisk.readString(path);
  }

  /**
   * Retrieve raw file content as a Buffer.
   */
  async getAsBuffer(path: string): Promise<Buffer> {
    return this.defaultDisk.read(path);
  }

  /**
   * Delete a file.
   */
  async delete(path: string): Promise<void> {
    await this.defaultDisk.delete(path);
  }

  /**
   * Check if a file exists.
   */
  async exists(path: string): Promise<boolean> {
    return this.defaultDisk.exists(path);
  }
}
