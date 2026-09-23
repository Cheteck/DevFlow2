# @mosaix/adapter-email-smtp

Nodemailer SMTP email adapter implementing [`EmailPort`](../../ports/email).

## Constructor

```typescript
new SmtpEmailAdapter(transporterOrOptions?: Transporter | SmtpEmailAdapterOptions);
```

- **Transporter** — use an existing nodemailer transporter.
- **options object** — passed to `nodemailer.createTransport` (SMTP connection config, e.g. `host`, `port`, `auth`).
- **`{ mock: true }`** — explicit mock mode: uses nodemailer's `jsonTransport` (captures messages without sending).
- **nothing** — **throws**: missing SMTP configuration is an error, never a silent fallback.

## Features

- Supports `to`, `cc`, `bcc` as a single address or an array.
- Sends `text` and/or `html` body.
- Returns the transporter `messageId` (falls back to a generated id if absent).

## Usage

```typescript
import { SmtpEmailAdapter } from "@mosaix/adapter-email-smtp";

const email = new SmtpEmailAdapter({
  host: "smtp.mailtrap.io",
  port: 2525,
  auth: { user: "...", pass: "..." },
});

await email.send({
  to: "user@example.com",
  from: "welcome@example.com",
  subject: "Hi!",
  text: "Hello there!",
});
```

## Related

- Port: [`@mosaix/ports-email`](../../ports/email)
