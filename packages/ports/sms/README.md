# @mosaix/ports-sms

SMS dispatch port for the MosaiX platform. Decouples application SMS messaging from Twilio, Nexmo or other providers.

## Exports

```typescript
export interface SmsMessage {
  to: string;
  from: string;
  body: string;
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

  async notifyUser(to: string) {
    const result = await this.sms.send({
      to,
      from: "+123456789",
      body: "Your MosaiX validation code is 123456.",
    });
    return result.messageId;
  }
}
```

## Adapters

- [`@mosaix/adapter-sms-twilio`](../../adapters/sms-twilio) — Twilio.
