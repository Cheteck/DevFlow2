# @mosaix/adapter-storage-local

Local filesystem storage adapter implementing [`StoragePort`](../../ports/storage), built on `node:fs/promises`.

## Constructor

```typescript
new LocalStorageAdapter(baseDir: string);
```

`baseDir` is required — all paths are resolved relative to it.

## Features

- **write** — creates parent directories recursively, then writes the file.
- **read** — returns a `Buffer`; **readString** — returns a UTF-8 string.
- **delete** — removes the file (`force: true`, missing files are not an error).
- **exists** — `true`/`false` based on `fs.access`.

## Usage

```typescript
import { LocalStorageAdapter } from "@mosaix/adapter-storage-local";

const storage = new LocalStorageAdapter("./uploads");
await storage.write("user-1/profile.txt", "John Doe");
const content = await storage.readString("user-1/profile.txt");
const exists = await storage.exists("user-1/profile.txt");
```

## Related

- Port: [`@mosaix/ports-storage`](../../ports/storage)
