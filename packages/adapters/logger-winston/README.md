# @mosaix/adapter-logger-winston

Winston logger adapter implementing [`LoggingPort`](../../ports/logging).

## Constructor

```typescript
new WinstonLoggerAdapter(options?: winston.LoggerOptions);
```

- **nothing** — defaults to `{ level: "info", transports: [Console with json format] }`.
- **options** — full winston configuration (transports, formats, levels).

## Features

- `error` attaches the error under `err`: `{ message, stack }` when an `Error` is passed, otherwise the raw value.

## Usage

```typescript
import { WinstonLoggerAdapter } from "@mosaix/adapter-logger-winston";

const logger = new WinstonLoggerAdapter();
logger.info("Application started", { service: "identity" });
logger.error("Request failed", new Error("boom"), { requestId: "abc" });
```

## Related

- Port: [`@mosaix/ports-logging`](../../ports/logging)
