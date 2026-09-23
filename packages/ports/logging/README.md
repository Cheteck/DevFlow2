# @mosaix/ports-logging

Logging port for the MosaiX platform. Decouples application logging from logging libraries (pino, winston, etc.).

## Exports

```typescript
export type LogMeta = Record<string, unknown>;

export interface LoggingPort {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, error?: Error | unknown, meta?: LogMeta): void;
}
```

## Notes

- `error` accepts an optional `Error` (or any value). Adapters typically attach it under an `err` key in structured output.

## Usage

```typescript
import type { LoggingPort } from "@mosaix/ports-logging";

class MyService {
  constructor(private readonly logger: LoggingPort) {}

  doSomething() {
    this.logger.info("Doing something...", { detail: "example" });
  }

  handleError(err: Error) {
    this.logger.error("Something failed", err, { requestId: "abc" });
  }
}
```

## Adapters

- [`@mosaix/adapter-logger-pino`](../../adapters/logger-pino) — pino.
- [`@mosaix/adapter-logger-winston`](../../adapters/logger-winston) — winston.
