# @mosaix/adapter-id-ulid

ULID generator adapter implementing [`IdGeneratorPort`](../../ports/id).

## Features

- 26-character ULID (10 chars timestamp + 16 chars randomness) in Base32 Crockford (`0123456789ABCDEFGHJKMNPQRSTVWXYZ`).
- Time-sortable: lexicographic order matches chronological order.
- Randomness sourced from `node:crypto` `getRandomValues`.

## Usage

```typescript
import { UlidGeneratorAdapter } from "@mosaix/adapter-id-ulid";

const idGen = new UlidGeneratorAdapter();
const id = idGen.generate(); // e.g. "01HX8KQJX0K2M3N4P5Q6R7S8T"
```

## Related

- Port: [`@mosaix/ports-id`](../../ports/id)
