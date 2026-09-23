# @mosaix/adapter-id-uuid

UUID generator adapter implementing [`IdGeneratorPort`](../../ports/id).

## Features

- UUID v4 via `node:crypto.randomUUID`.
- Zero dependencies.

## Usage

```typescript
import { UuidGeneratorAdapter } from "@mosaix/adapter-id-uuid";

const idGen = new UuidGeneratorAdapter();
const id = idGen.generate(); // e.g. "9f7d1e4c-..." (v4)
```

## Related

- Port: [`@mosaix/ports-id`](../../ports/id)
