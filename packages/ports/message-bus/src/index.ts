export type MessageHandler<T> = (message: T) => void | Promise<void>;

/**
 * MessageBusPort — Decouples application commands / events orchestration in-memory or in-process.
 */
export interface MessageBusPort {
  /** Asynchronously publishes a message on the bus. */
  publish<T>(topic: string, message: T): Promise<void>;
  /** Subscribes to a topic. Returns an unsubscribe callback. */
  subscribe<T>(topic: string, handler: MessageHandler<T>): () => void;
}
