# @mosaix/adapter-storage-s3

AWS S3 storage adapter implementing [`StoragePort`](../../ports/storage), built on `@aws-sdk/client-s3`.

## Constructor

```typescript
new S3StorageAdapter(bucketName: string, clientOrConfig?: S3Client | Record<string, unknown>);
```

- `bucketName` is required — all paths are object keys inside this bucket.
- **S3Client** — use an existing client.
- **config object** — passed as `S3Client` configuration (e.g. `{ region: "us-east-1" }`).

## Features

- **write** — `PutObjectCommand`; strings are converted to a `Buffer`.
- **read** — `GetObjectCommand`, returns a `Buffer` (throws on empty body); **readString** — UTF-8.
- **delete** — `DeleteObjectCommand`.
- **exists** — `HeadObjectCommand`; returns `false` on `NotFound` or HTTP 404, rethrows other errors.

## Usage

```typescript
import { S3StorageAdapter } from "@mosaix/adapter-storage-s3";

const storage = new S3StorageAdapter("my-aws-bucket", { region: "us-east-1" });
await storage.write("avatar.png", imageBuffer);
const data = await storage.read("avatar.png");
```

## Related

- Port: [`@mosaix/ports-storage`](../../ports/storage)
