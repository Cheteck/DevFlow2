import type { MessageBusPort, MessageHandler } from "@mosaix/ports-message-bus";

export interface MosaixMessageBusOptions {
  /** Optional error notifier invoked when a message handler throws. Defaults to `console.error`. */
  onHandlerError?: (error: unknown, context: { topic: string }) => void;
}

export class MosaixMessageBusAdapter implements MessageBusPort {
  private readonly handlers = new Map<string, Set<MessageHandler<unknown>>>();
  private readonly onHandlerError:
    ((error: unknown, context: { topic: string }) => void) | undefined;

  constructor(options: MosaixMessageBusOptions = {}) {
    this.onHandlerError = options.onHandlerError;
  }

  async publish<T>(topic: string, message: T): Promise<void> {
    const list = this.handlers.get(topic);
    if (!list) return;

    const promises = Array.from(list).map(async (handler) => {
      try {
        await handler(message);
      } catch (error: unknown) {
        if (this.onHandlerError) {
          this.onHandlerError(error, { topic });
        } else {
          // Default behaviour: surface handler errors without breaking the
          // other handlers. The parent (kernel / application) can opt into an
          // explicit notifier via `onHandlerError`.
          console.error(
            `[MosaixMessageBusAdapter] error in message handler for topic "${topic}":`,
            error,
          );
        }
      }
    });

    await Promise.all(promises);
  }

  subscribe<T>(topic: string, handler: MessageHandler<T>): () => void {
    let list = this.handlers.get(topic);
    if (!list) {
      list = new Set();
      this.handlers.set(topic, list);
    }
    list.add(handler as MessageHandler<unknown>);

    return () => {
      list?.delete(handler as MessageHandler<unknown>);
    };
  }
}
