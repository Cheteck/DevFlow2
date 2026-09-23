# @mosaix/adapter-messagebus-mosaix

In-memory message bus adapter implementing [`MessageBusPort`](../../ports/message-bus). Topic-based, in-process, no external broker.

## Features

- **subscribe** — registers a handler and returns an **unsubscribe** callback.
- **publish** — fans a message out to all handlers for the topic and awaits them (`Promise.all`).
- **Error handling** — a handler error is logged via `console.error` and does not break the other handlers. Pass `onHandlerError(error, { topic })` to `new MosaixMessageBusAdapter(options)` to deregister the notification instead (e.g. route it to a monitoring system or rethrow).

## Usage

```typescript
import { MosaixMessageBusAdapter } from "@mosaix/adapter-messagebus-mosaix";

const bus = new MosaixMessageBusAdapter({
  onHandlerError: (error, { topic }) => console.error({ topic }, error),
});
const unsubscribe = bus.subscribe("topic", (msg) => console.log(msg));

await bus.publish("topic", "message content");
unsubscribe();
```

## Related

- Port: [`@mosaix/ports-message-bus`](../../ports/message-bus)
