# @mosaix/ports-sms

SMS dispatch port for the MosaiX platform. Decouples application SMS from Twilio, MessageBird, or other carriers.

## Exports

```typescript
export interface SmsMessage {
  to: string;
  message: string;
}

export interface SmsResult {
  messageId: string;
}

export interface SmsPort {
  send(message: SmsMessage): Promise<SmsResult>;
}
```

## Usage

```typescript
import type { SmsPort } from "@mosaix/ports-sms";

class MyService {
  constructor(private readonly sms: SmsPort) {}

  async sendVerificationCode(to: string, code: string) {
    const result = await this.sms.send({
      to,
      message: `Your verification code is: ${code}`,
    });
    return result.messageId;
  }
}
```

## Adapters

- [`@mosaix/adapter-sms-console`](../../adapters/sms-console) — Development/testing console logger.
- [`@mosaix/adapter-sms-twilio`](../../adapters/sms-twilio) — Twilio (future).
- [`@mosaix/adapter-sms-messagebird`](../../adapters/sms-messagebird) — MessageBird (future).