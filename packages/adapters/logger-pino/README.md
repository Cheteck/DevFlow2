# @mosaix/adapter-logger-pino

Pino logger adapter implementing [`LoggingPort`](../../ports/logging).

## Constructor

```typescript
new PinoLoggerAdapter(options?: pino.LoggerOptions, destination?: pino.DestinationStream);
```

- **options** — pino options; defaults to `{ level: "info" }`.
- **destination** — optional output stream (file, transport).

## Features

- Structured JSON logging with `meta` as the first argument (pino convention).
- `error` attaches the error under `err`: `{ message, stack }` when an `Error` is passed, otherwise the raw value.

## Usage

```typescript
import { PinoLoggerAdapter } from "@mosaix/adapter-logger-pino";

const logger = new PinoLoggerAdapter();
logger.info("Application started", { service: "identity" });
logger.error("Request failed", new Error("boom"), { requestId: "abc" });
```

## Related

- Port: [`@mosaix/ports-logging`](../../ports/logging)
