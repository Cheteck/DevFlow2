export type EventListener<T = unknown> = (payload: T) => void | Promise<void>;

export class EventDispatcher {
  private listeners = new Map<string, EventListener<unknown>[]>();

  /**
   * Register an event listener with the dispatcher.
   */
  listen<T = unknown>(event: string, listener: EventListener<T>): void {
    const list = this.listeners.get(event) ?? [];
    list.push(listener as EventListener<unknown>);
    this.listeners.set(event, list);
  }

  /**
   * Determine if a given event has listeners.
   */
  hasListeners(event: string): boolean {
    const list = this.listeners.get(event);
    return list !== undefined && list.length > 0;
  }

  /**
   * Fire an event and call all of its listeners.
   */
  async dispatch<T = unknown>(event: string, payload?: T): Promise<void> {
    const list = this.listeners.get(event);
    if (list === undefined) {
      return;
    }

    for (const listener of list) {
      await listener(payload);
    }
  }

  /**
   * Remove all of the listeners for a given event.
   */
  forget(event: string): void {
    this.listeners.delete(event);
  }

  /**
   * Register an event subscriber class instance.
   */
  subscribe(subscriber: {
    subscribe: (dispatcher: EventDispatcher) => void;
  }): void {
    subscriber.subscribe(this);
  }
}
