# @mosaix/ports-id

ID generator port for the MosaiX platform. Decouples unique ID generation from the domain.

## Exports

```typescript
export interface IdGeneratorPort {
  generate(): string;
}
```

## Usage

```typescript
import type { IdGeneratorPort } from "@mosaix/ports-id";

class MyService {
  constructor(private readonly idGen: IdGeneratorPort) {}

  create() {
    const id = this.idGen.generate();
    // ...
  }
}
```

## Adapters

- [`@mosaix/adapter-id-uuid`](../../adapters/id-uuid) — UUID v4 (`node:crypto` `randomUUID`).
- [`@mosaix/adapter-id-ulid`](../../adapters/id-ulid) — ULID (time-sortable, Base32 Crockford).
