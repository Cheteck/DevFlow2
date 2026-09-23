# @mosaix/adapter-clock-fake

Controllable fake clock adapter implementing [`ClockPort`](../../ports/clock), for deterministic time in tests.

## Constructor

```typescript
new FakeClockAdapter(initialTime?: Date);
```

Defaults to `2026-01-01T00:00:00.000Z`.

## Features

- `now()` / `nowISO()` return the current (controlled) time.
- **`tick(ms)`** — advances the clock by the given number of milliseconds.
- **`setTime(time)`** — jumps the clock to a specific `Date`.
- `now()` returns a copy, so mutating the result does not affect the internal state.

## Usage

```typescript
import { FakeClockAdapter } from "@mosaix/adapter-clock-fake";

const clock = new FakeClockAdapter(new Date("2026-08-05T12:00:00.000Z"));

clock.tick(1000); // advance 1 sec
const now = clock.nowISO(); // "2026-08-05T12:00:01.000Z"

clock.setTime(new Date("2026-01-01T00:00:00.000Z"));
```

## Related

- Port: [`@mosaix/ports-clock`](../../ports/clock)
