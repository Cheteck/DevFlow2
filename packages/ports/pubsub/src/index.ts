export type PubSubHandler<T> = (message: T) => void | Promise<void>;

/**
 * PubSubPort — Decouples distributed Pub/Sub (Kafka, RabbitMQ, Redis Pub/Sub, etc.).
 */
export interface PubSubPort {
  /** Asynchronously publishes a message to a topic. */
  publish<T>(topic: string, message: T): Promise<void>;
  /** Asynchronously subscribes to a topic. */
  subscribe<T>(
    topic: string,
    queueGroup: string,
    handler: PubSubHandler<T>,
  ): Promise<() => Promise<void>>;
}
