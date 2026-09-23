# @mosaix/adapter-kafka

Kafka Pub/Sub adapter implementing [`PubSubPort`](../../ports/pubsub), built on [kafkajs](https://github.com/tulios/kafkajs).

## Constructor

```typescript
new KafkaPubSubAdapter(kafkaOrConfig?: Kafka | { clientId?: string; brokers?: string[] });
```

- **Kafka instance** — use an existing client.
- **config object** — `{ clientId, brokers }`; defaults `mosaix-client` and `["localhost:9092"]`.

## Features

- **publish** — lazily connects the producer; non-string messages are JSON-serialized.
- **subscribe** — creates a consumer with `groupId = queueGroup`, subscribes to the topic, and JSON-parses each message (raw string fallback). Returns an async unsubscriber.
- **disconnect** — closes producer and all consumers (not part of the port; call during shutdown).

## Usage

```typescript
import { KafkaPubSubAdapter } from "@mosaix/adapter-kafka";

const pubsub = new KafkaPubSubAdapter({ brokers: ["localhost:9092"] });
await pubsub.publish("my-topic", { msg: "Hello Kafka!" });

const unsubscribe = await pubsub.subscribe(
  "my-topic",
  "worker-group",
  (msg) => {
    console.log(msg);
  },
);

await pubsub.disconnect();
```

## Related

- Port: [`@mosaix/ports-pubsub`](../../ports/pubsub)
