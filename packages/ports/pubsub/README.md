# @mosaix/ports-pubsub

Distributed Pub/Sub port for the MosaiX platform. Decouples publish/subscribe messaging from Kafka, RabbitMQ, Redis Pub/Sub, etc.

## Exports

```typescript
export type PubSubHandler<T> = (message: T) => void | Promise<void>;

export interface PubSubPort {
  publish<T>(topic: string, message: T): Promise<void>;
  subscribe<T>(
    topic: string,
    queueGroup: string,
    handler: PubSubHandler<T>,
  ): Promise<() => Promise<void>>;
}
```

## Notes

- `queueGroup` provides consumer-group semantics: multiple subscribers sharing a queue group split the workload; different groups each receive a copy.
- `subscribe` is async and returns an async **unsubscribe** function.
- Non-string messages are JSON-serialized by implementations.

## Usage

```typescript
import type { PubSubPort } from "@mosaix/ports-pubsub";

class MyService {
  constructor(private readonly pubsub: PubSubPort) {}

  async publishMessage() {
    await this.pubsub.publish("orders", { orderId: "123" });
  }

  async startConsumer() {
    const unsubscribe = await this.pubsub.subscribe(
      "orders",
      "orders-worker",
      (msg) => {
        console.log(msg);
      },
    );
    return unsubscribe;
  }
}
```

## Adapters

- [`@mosaix/adapter-kafka`](../../adapters/kafka) — Kafka (kafkajs).
- [`@mosaix/adapter-rabbitmq`](../../adapters/rabbitmq) — RabbitMQ (amqplib, fanout exchanges).
