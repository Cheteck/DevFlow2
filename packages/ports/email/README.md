# @mosaix/ports-email

Email dispatch port for the MosaiX platform. Decouples application emails from nodemailer, AWS SES or other clients.

## Exports

```typescript
export interface EmailMessage {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface EmailResult {
  messageId: string;
}

export interface EmailPort {
  send(message: EmailMessage): Promise<EmailResult>;
}
```

## Usage

```typescript
import type { EmailPort } from "@mosaix/ports-email";

class MyService {
  constructor(private readonly email: EmailPort) {}

  async notifyUser(to: string) {
    const result = await this.email.send({
      to,
      from: "no-reply@example.com",
      subject: "Welcome",
      text: "Welcome to MosaiX!",
      html: "<h1>Welcome to MosaiX!</h1>",
    });
    return result.messageId;
  }
}
```

## Adapters

- [`@mosaix/adapter-email-smtp`](../../adapters/email-smtp) — nodemailer SMTP.
- [`@mosaix/adapter-email-ses`](../../adapters/email-ses) — AWS SES.
