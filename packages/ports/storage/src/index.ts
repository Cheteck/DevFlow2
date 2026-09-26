/**
 * @mosaix/ports-storage — StoragePort (blob/file persistence contract).
 *
 * Implemented by `@mosaix/adapter-storage-local` and
 * `@mosaix/adapter-storage-s3`, consumed by `@mosaix/filesystem`.
 */
export interface StoragePort {
  write(path: string, content: Buffer | string): Promise<void>;
  read(path: string): Promise<Buffer>;
  readString(path: string): Promise<string>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}
