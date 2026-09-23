import amqp from "amqplib";
import type { PubSubPort, PubSubHandler } from "@mosaix/ports-pubsub";

export class RabbitMqPubSubAdapter implements PubSubPort {
  private connection?: amqp.ChannelModel;
  private channel?: amqp.Channel;

  constructor(private readonly urlOrConnection?: amqp.ChannelModel | string) {}

  private async getChannel(): Promise<amqp.Channel> {
    if (this.channel) return this.channel;

    if (this.urlOrConnection && typeof this.urlOrConnection !== "string") {
      this.connection = this.urlOrConnection;
    } else {
      this.connection = await amqp.connect(
        typeof this.urlOrConnection === "string"
          ? this.urlOrConnection
          : "amqp://localhost",
      );
    }

    this.channel = await this.connection.createChannel();
    return this.channel;
  }

  async publish<T>(topic: string, message: T): Promise<void> {
    const channel = await this.getChannel();
    // Enforce topic exchange model
    await channel.assertExchange(topic, "fanout", { durable: true });

    const payload =
      typeof message === "string" ? message : JSON.stringify(message);
    channel.publish(topic, "", Buffer.from(payload));
  }

  async subscribe<T>(
    topic: string,
    queueGroup: string,
    handler: PubSubHandler<T>,
  ): Promise<() => Promise<void>> {
    const channel = await this.getChannel();
    await channel.assertExchange(topic, "fanout", { durable: true });

    // Bind shared queueGroup to topic exchange
    const q = await channel.assertQueue(queueGroup, { durable: true });
    await channel.bindQueue(q.queue, topic, "");

    const res = await channel.consume(q.queue, async (msg) => {
      if (!msg) return;

      const raw = msg.content.toString();
      try {
        const parsed = JSON.parse(raw) as T;
        await handler(parsed);
      } catch {
        await handler(raw as unknown as T);
      }

      channel.ack(msg);
    });

    return async () => {
      await channel.cancel(res.consumerTag);
    };
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }
}
