# @mosaix/adapter-clock-system

System clock adapter implementing [`ClockPort`](../../ports/clock). Returns real wall-clock time.

## Usage

```typescript
import { SystemClockAdapter } from "@mosaix/adapter-clock-system";

const clock = new SystemClockAdapter();
const now = clock.now(); // current Date
const iso = clock.nowISO(); // ISO 8601 string
```

## Related

- Port: [`@mosaix/ports-clock`](../../ports/clock)
