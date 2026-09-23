# @mosaix/ports-message-bus

Message bus port for the MosaiX platform. Decouples in-process command/event orchestration from the in-memory or in-process implementation.

## Exports

```typescript
export type MessageHandler<T> = (message: T) => void | Promise<void>;

export interface MessageBusPort {
  publish<T>(topic: string, message: T): Promise<void>;
  subscribe<T>(topic: string, handler: MessageHandler<T>): () => void;
}
```

## Notes

- `subscribe` returns an **unsubscribe** callback; call it to stop receiving messages.
- Unlike `PubSubPort`, this is an in-process bus (no external broker, no consumer groups).

## Usage

```typescript
import type { MessageBusPort } from "@mosaix/ports-message-bus";

class MyService {
  constructor(private readonly bus: MessageBusPort) {}

  start() {
    const unsubscribe = this.bus.subscribe("user.signup", (msg) => {
      console.log(msg);
    });
    return unsubscribe;
  }

  async notify() {
    await this.bus.publish("user.signup", { email: "grace@example.com" });
  }
}
```

## Adapters

- [`@mosaix/adapter-messagebus-mosaix`](../../adapters/messagebus-mosaix) — in-memory topic-based bus.
