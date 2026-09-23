# @mosaix/adapter-email-ses

AWS SES email adapter implementing [`EmailPort`](../../ports/email), built on `@aws-sdk/client-ses`.

## Constructor

```typescript
new SesEmailAdapter(clientOrConfig?: SESClient | Record<string, unknown>);
```

- **SESClient** — use an existing configured client.
- **plain object** — passed as `SESClient` configuration (e.g. `{ region: "us-east-1" }`).
- **nothing** — creates an `SESClient` with default config.

## Features

- Supports `to`, `cc`, `bcc` as a single address or an array.
- Sends `text` and/or `html` body with UTF-8 charset.
- Returns the SES `MessageId` (falls back to a generated id if absent).

## Usage

```typescript
import { SesEmailAdapter } from "@mosaix/adapter-email-ses";

const email = new SesEmailAdapter({ region: "us-east-1" });
await email.send({
  to: ["user@example.com", "ops@example.com"],
  cc: "manager@example.com",
  from: "admin@example.com",
  subject: "AWS notification",
  text: "Hello from SES",
  html: "<p>Hello from SES</p>",
});
```

## Related

- Port: [`@mosaix/ports-email`](../../ports/email)
