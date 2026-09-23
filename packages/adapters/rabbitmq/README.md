# @mosaix/adapter-rabbitmq

RabbitMQ Pub/Sub adapter implementing [`PubSubPort`](../../ports/pubsub), built on [amqplib](https://github.com/amqp-node/amqplib).

## Constructor

```typescript
new RabbitMqPubSubAdapter(urlOrConnection?: string | ChannelModel);
```

- **string** — AMQP connection URL (defaults to `amqp://localhost`).
- **connection** — an existing amqplib connection.
- **nothing** — `amqp://localhost`.

## Features

- **Topics as fanout exchanges** — each topic is declared as a durable fanout exchange.
- **subscribe** — declares a durable queue named `queueGroup`, binds it to the exchange, consumes with auto-ack after the handler resolves. Non-string messages are JSON-parsed (raw string fallback). Returns an async unsubscriber.
- **disconnect** — closes the channel and connection (not part of the port; call during shutdown).

## Usage

```typescript
import { RabbitMqPubSubAdapter } from "@mosaix/adapter-rabbitmq";

const pubsub = new RabbitMqPubSubAdapter("amqp://localhost");
await pubsub.publish("my-exchange", { hello: "world" });

const unsubscribe = await pubsub.subscribe(
  "my-exchange",
  "worker-group",
  (msg) => {
    console.log(msg);
  },
);

await pubsub.disconnect();
```

## Related

- Port: [`@mosaix/ports-pubsub`](../../ports/pubsub)
