# @mosaix/ports-clock

Clock port for the MosaiX platform. Decouples system time from the domain, enabling deterministic tests.

## Exports

```typescript
export interface ClockPort {
  now(): Date;
  nowISO(): string;
}
```

## Usage

```typescript
import type { ClockPort } from "@mosaix/ports-clock";

class MyService {
  constructor(private readonly clock: ClockPort) {}

  doSomething() {
    const timestamp = this.clock.nowISO();
    // ...
  }
}
```

## Adapters

- [`@mosaix/adapter-clock-system`](../../adapters/clock-system) — real system time.
- [`@mosaix/adapter-clock-fake`](../../adapters/clock-fake) — controllable fake clock (`tick`, `setTime`) for tests.
