import { Kafka, type Producer, type Consumer } from "kafkajs";
import type { PubSubPort, PubSubHandler } from "@mosaix/ports-pubsub";

export class KafkaPubSubAdapter implements PubSubPort {
  private readonly kafka: Kafka;
  private producer?: Producer;
  private readonly consumers: Consumer[] = [];

  constructor(kafkaOrConfig?: Kafka | Record<string, unknown>) {
    if (
      kafkaOrConfig &&
      (kafkaOrConfig instanceof Kafka ||
        (typeof kafkaOrConfig === "object" && "producer" in kafkaOrConfig))
    ) {
      this.kafka = kafkaOrConfig as Kafka;
    } else {
      const config = (kafkaOrConfig as Record<string, unknown>) ?? {};
      this.kafka = new Kafka({
        clientId: (config["clientId"] as string) ?? "mosaix-client",
        brokers: (config["brokers"] as string[]) ?? ["localhost:9092"],
      });
    }
  }

  async publish<T>(topic: string, message: T): Promise<void> {
    if (!this.producer) {
      this.producer = this.kafka.producer();
      await this.producer.connect();
    }

    const value =
      typeof message === "string" ? message : JSON.stringify(message);

    await this.producer.send({
      topic,
      messages: [{ value }],
    });
  }

  async subscribe<T>(
    topic: string,
    queueGroup: string,
    handler: PubSubHandler<T>,
  ): Promise<() => Promise<void>> {
    const consumer = this.kafka.consumer({ groupId: queueGroup });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ message }) => {
        const raw = message.value?.toString();
        if (raw === undefined || raw === null) return;

        try {
          const parsed = JSON.parse(raw) as T;
          await handler(parsed);
        } catch {
          await handler(raw as unknown as T);
        }
      },
    });

    this.consumers.push(consumer);

    return async () => {
      await consumer.disconnect();
      const idx = this.consumers.indexOf(consumer);
      if (idx !== -1) {
        this.consumers.splice(idx, 1);
      }
    };
  }

  async disconnect(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
    }
    const disconnects = this.consumers.map((c) => c.disconnect());
    await Promise.all(disconnects);
    this.consumers.length = 0;
  }
}
