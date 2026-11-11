# @mosaix/ports-whatsapp

WhatsApp dispatch port for the MosaiX platform. Decouples application WhatsApp messages from Meta Cloud API, Twilio WhatsApp or other carriers.

## Exports

```typescript
export interface WhatsAppMessage {
  to: string;
  message: string;
  template?: string;
}

export interface WhatsAppResult {
  messageId: string;
}

export interface WhatsAppPort {
  send(message: WhatsAppMessage): Promise<WhatsAppResult>;
}
```

## Usage

```typescript
import type { WhatsAppPort } from "@mosaix/ports-whatsapp";

class Notifier {
  constructor(private readonly wa: WhatsAppPort) {}

  async notify(to: string, msg: string) {
    const result = await this.wa.send({ to, message: msg });
    return result.messageId;
  }
}
```

## Adapters

- [`@mosaix/adapter-whatsapp-console`](../../adapters/whatsapp-console) — Development logger.
- [`@mosaix/adapter-whatsapp-meta`](../../adapters/whatsapp-meta) — Meta Cloud API (future).
- [`@mosaix/adapter-whatsapp-twilio`](../../adapters/whatsapp-twilio) — Twilio WhatsApp (future).