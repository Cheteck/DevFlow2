/**
 * @mosaix/shell — Distributed Event Backplane & Realtime Broadcast
 * Bridges local events to multi-node SSE / Redis PubSub cluster channels.
 */

export interface DistributedEventMessage {
  id: string;
  topic: string;
  payload: unknown;
  timestamp: number;
  originNodeId: string;
}

export type BackplaneListener = (message: DistributedEventMessage) => void;

export interface ClusterTransportAdapter {
  publish(topic: string, message: DistributedEventMessage): Promise<void>;
  subscribe(
    topic: string,
    onMessage: (message: DistributedEventMessage) => void,
  ): Promise<() => void>;
  close?(): Promise<void>;
}

export class DistributedEventBackplane {
  private static instance: DistributedEventBackplane;
  // Stable across restarts when set (D-04): HOSTNAME in containers,
  // MOSAIX_NODE_ID for explicit topologies, random suffix otherwise.
  private nodeId =
    process.env.MOSAIX_NODE_ID ||
    (typeof process !== "undefined" && process.env.HOSTNAME
      ? `node_${process.env.HOSTNAME}`
      : `node_${Math.random().toString(36).substring(2, 9)}`);
  private listeners = new Map<string, Set<BackplaneListener>>();
  private sseClients = new Set<(event: string, data: string) => void>();
  private clusterAdapter?: ClusterTransportAdapter;

  static getInstance(): DistributedEventBackplane {
    if (!this.instance) {
      this.instance = new DistributedEventBackplane();
    }
    return this.instance;
  }

  setClusterAdapter(adapter: ClusterTransportAdapter): void {
    this.clusterAdapter = adapter;
    console.info(
      `[EventBackplane] Cluster transport adapter attached for node ${this.nodeId}`,
    );
  }

  getNodeId(): string {
    return this.nodeId;
  }

  publish(topic: string, payload: unknown): DistributedEventMessage {
    const message: DistributedEventMessage = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      topic,
      payload,
      timestamp: Date.now(),
      originNodeId: this.nodeId,
    };

    // 1. Dispatch to local topic listeners
    this.dispatchLocal(message);

    // 2. Relay to external cluster transport if configured (Redis / NATS)
    if (this.clusterAdapter) {
      this.clusterAdapter.publish(topic, message).catch((err) => {
        console.error(
          `[EventBackplane] Cluster publication error on [${topic}]:`,
          err,
        );
      });
    }

    // 3. Broadcast to connected SSE clients
    const ssePayload = JSON.stringify(message);
    for (const send of this.sseClients) {
      try {
        send(topic, ssePayload);
      } catch {
        this.sseClients.delete(send);
      }
    }

    return message;
  }

  dispatchLocal(message: DistributedEventMessage): void {
    const topicListeners = this.listeners.get(message.topic);
    if (topicListeners) {
      for (const listener of topicListeners) {
        try {
          listener(message);
        } catch (err) {
          console.error(
            `[EventBackplane] Error in topic listener [${message.topic}]:`,
            err,
          );
        }
      }
    }
  }

  subscribe(topic: string, listener: BackplaneListener): () => void {
    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, new Set());
    }
    const set = this.listeners.get(topic)!;
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(topic);
    };
  }

  registerSseClient(send: (event: string, data: string) => void): () => void {
    this.sseClients.add(send);
    return () => this.sseClients.delete(send);
  }

  getActiveSseClientsCount(): number {
    return this.sseClients.size;
  }
}

export const distributedEventBackplane =
  DistributedEventBackplane.getInstance();
