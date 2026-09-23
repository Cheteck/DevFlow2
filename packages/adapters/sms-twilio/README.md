# @mosaix/adapter-sms-twilio

Twilio SMS adapter implementing [`SmsPort`](../../ports/sms), built on the Twilio SDK.

## Constructor

```typescript
new TwilioSmsAdapter(clientOrConfig?: Twilio | TwilioSmsAdapterConfig);
```

- **Twilio client** — use an existing client (detected via `instanceof` / the `messages` surface).
- **config object** — `{ accountSid, authToken }` (both required).
- **`{ mock: true }`** — explicit offline mock client (returns generated SIDs, never contacts Twilio).
- **nothing / missing credentials** — **throws**: `accountSid` and `authToken` are required; there is no silent `ACmock` / `mockToken` fallback.

## Features

- `send` creates an SMS via `client.messages.create` and returns the Twilio SID as `messageId` (falls back to a generated id if absent).

## Usage

```typescript
import { TwilioSmsAdapter } from "@mosaix/adapter-sms-twilio";

const sms = new TwilioSmsAdapter({
  accountSid: "AC...",
  authToken: "...",
});

await sms.send({
  to: "+123456789",
  from: "+987654321",
  body: "Hello from MosaiX Twilio!",
});
```

## Related

- Port: [`@mosaix/ports-sms`](../../ports/sms)
