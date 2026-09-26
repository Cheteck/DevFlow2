/**
 * @mosaix/plugin-engine/runtime — Inter-Plugin Event Bus
 */

import * as crypto from "node:crypto";

export interface PluginEvent<T = unknown> {
  id: string;
  topic: string; // e.g. "plugin:theme:colorChanged" or "plugin:analytics:pageView"
  sourcePluginId: string;
  timestamp: string;
  payload: T;
}

export type PluginEventListener<T = unknown> = (event: PluginEvent<T>) => Promise<void> | void;

export interface EventSubscription {
  id: string;
  topicPattern: string;
  subscriberPluginId: string;
  // `any` (not `unknown`): typed listeners `(event: PluginEvent<T>) => ...`
  // must stay assignable under `strictFunctionTypes`; dispatch passes the
  // concrete event through.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listener: PluginEventListener<any>;
  unsubscribe: () => void;
}

export class PluginEventBus {
  private subscriptions = new Map<string, EventSubscription>();
  private eventHistory: PluginEvent[] = [];
  private maxHistorySize = 100;

  /**
   * Subscribe a plugin to an event pattern (exact match or wildcard suffix 'plugin:theme:*')
   */
  subscribe<T = unknown>(
    topicPattern: string,
    subscriberPluginId: string,
    listener: PluginEventListener<T>
  ): EventSubscription {
    const subId = `sub_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const subscription: EventSubscription = {
      id: subId,
      topicPattern,
      subscriberPluginId,
      listener,
      unsubscribe: () => {
        this.subscriptions.delete(subId);
      },
    };

    this.subscriptions.set(subId, subscription);
    return subscription;
  }

  /**
   * Publish an event from a source plugin to all matching subscribers
   */
  async publish<T = unknown>(
    topic: string,
    sourcePluginId: string,
    payload: T
  ): Promise<{ deliveredCount: number; errors: Array<{ subId: string; error: Error }> }> {
    const event: PluginEvent<T> = {
      id: `evt_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      topic,
      sourcePluginId,
      timestamp: new Date().toISOString(),
      payload: Object.freeze(payload),
    };

    // Store in history
    this.eventHistory.unshift(event as PluginEvent);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.pop();
    }

    const errors: Array<{ subId: string; error: Error }> = [];
    let deliveredCount = 0;

    const matchingSubs: EventSubscription[] = [];
    for (const sub of this.subscriptions.values()) {
      if (this.matchesTopic(sub.topicPattern, topic)) {
        matchingSubs.push(sub);
      }
    }

    const promises = matchingSubs.map(async (sub) => {
      try {
        await sub.listener(event);
        deliveredCount++;
      } catch (err) {
        errors.push({
          subId: sub.id,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    });

    await Promise.all(promises);

    return { deliveredCount, errors };
  }

  /**
   * Unsubscribe all listeners belonging to a plugin (e.g. on unload)
   */
  unsubscribePlugin(pluginId: string): number {
    let count = 0;
    for (const [id, sub] of this.subscriptions.entries()) {
      if (sub.subscriberPluginId === pluginId) {
        this.subscriptions.delete(id);
        count++;
      }
    }
    return count;
  }

  private matchesTopic(pattern: string, actual: string): boolean {
    if (pattern === "*" || pattern === actual) return true;
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      return actual.startsWith(prefix);
    }
    return false;
  }

  getRecentEvents(): readonly PluginEvent[] {
    return this.eventHistory;
  }

  getActiveSubscriptions(): readonly EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }
}
