/**
 * @mosaix/adapter-session-store-redis – Redis adapter for SessionStore port.
 */

import Redis from "ioredis";
import type { RedisOptions } from "ioredis";
import type { Session, SessionStore } from "@mosaix/ports-session-store";

export interface RedisSessionStoreOptions {
  /** Explicitly opt into the in-memory mock client (no Redis connection). */
  mock?: boolean;
  /** Redis server host. */
  host?: string;
  /** Redis server port. */
  port?: number;
  /** Unix socket path (when connecting over a local socket). */
  path?: string;
  /** Key prefix for all session keys. */
  keyPrefix?: string;
  /** Additional ioredis connection options forwarded to `new Redis(...)`. */
  [key: string]: unknown;
}

/* Minimal in-memory stand-in for the redis client surface the adapter uses. */
class InMemoryRedisClient {
  private readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, _mode?: string, _ttl?: number): Promise<"OK"> {
    this.store.set(key, value);
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async flushdb(): Promise<void> {
    this.store.clear();
  }

  async quit(): Promise<void> {}
}

export class RedisSessionStoreAdapter implements SessionStore {
  private readonly client: Redis | InMemoryRedisClient;
  private readonly keyPrefix: string;

  constructor(clientOrOptions?: Redis | string | RedisSessionStoreOptions) {
    if (
      clientOrOptions &&
      typeof clientOrOptions === "object" &&
      typeof (clientOrOptions as Redis).get === "function"
    ) {
      this.client = clientOrOptions as Redis;
      this.keyPrefix = (clientOrOptions as RedisSessionStoreOptions).keyPrefix ?? "session:";
      return;
    }

    if (typeof clientOrOptions === "string") {
      this.client = new Redis(clientOrOptions);
      this.keyPrefix = "session:";
      return;
    }

    const options: RedisSessionStoreOptions = (clientOrOptions as RedisSessionStoreOptions | undefined) ?? {};

    if (options.mock === true) {
      this.client = new InMemoryRedisClient();
      this.keyPrefix = options.keyPrefix ?? "session:";
      return;
    }

    const { mock: _mock, ...connection } = options;
    if (Object.keys(connection).length === 0) {
      throw new Error(
        "RedisSessionStoreAdapter: missing Redis connection configuration. Provide a Redis instance, a connection URL/options (e.g. `host`, `port`), or `{ mock: true }` to explicitly opt into the in-memory mock client.",
      );
    }

    this.client = new Redis(connection as RedisOptions);
    this.keyPrefix = options.keyPrefix ?? "session:";
  }

  private makeKey(id: string): string {
    return `${this.keyPrefix}${id}`;
  }

  private makeIdentityKey(identityId: string): string {
    return `${this.keyPrefix}identity:${identityId}`;
  }

  async create(session: Session): Promise<void> {
    const sessionKey = this.makeKey(session.id);
    const identityKey = this.makeIdentityKey(session.identityId);

    const ttlSeconds = Math.max(
      0,
      Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000)
    );

    await this.client.set(sessionKey, JSON.stringify(session), "EX", ttlSeconds);

    const existing = (await this.client.get(identityKey)) ?? "[]";
    const ids: string[] = JSON.parse(existing);
    if (!ids.includes(session.id)) {
      ids.push(session.id);
    }
    await this.client.set(identityKey, JSON.stringify(ids), "EX", 86400 * 30);
  }

  async get(id: string): Promise<Session | null> {
    const raw = await this.client.get(this.makeKey(id));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  }

  async revoke(id: string): Promise<void> {
    const session = await this.get(id);
    if (!session) return;

    const revokedSession = {
      ...session,
      revokedAt: new Date().toISOString(),
    };

    const ttlSeconds = Math.max(
      0,
      Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000)
    );
    await this.client.set(this.makeKey(id), JSON.stringify(revokedSession), "EX", ttlSeconds);

    const identityKey = this.makeIdentityKey(session.identityId);
    const existing = (await this.client.get(identityKey)) ?? "[]";
    const ids: string[] = JSON.parse(existing).filter((sid: string) => sid !== id);
    await this.client.set(identityKey, JSON.stringify(ids), "EX", 86400 * 30);
  }

  async revokeAllForIdentity(identityId: string): Promise<void> {
    const identityKey = this.makeIdentityKey(identityId);
    const sessionIds = (await this.client.get(identityKey)) ?? "[]";
    const ids: string[] = JSON.parse(sessionIds);

    for (const sessionId of ids) {
      await this.revoke(sessionId);
    }

    await this.client.del(identityKey);
  }

  async listActiveForIdentity(identityId: string): Promise<Session[]> {
    const identityKey = this.makeIdentityKey(identityId);
    const sessionIds = (await this.client.get(identityKey)) ?? "[]";
    const ids: string[] = JSON.parse(sessionIds);

    const sessions: Session[] = [];
    for (const sessionId of ids) {
      const session = await this.get(sessionId);
      if (
        session &&
        !session.revokedAt &&
        new Date(session.expiresAt).getTime() > Date.now()
      ) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

/**
 * Redis session store adapter factory.
 *
 * @param options - Redis connection options
 * @returns SessionStore implementation
 */
export function createRedisSessionStore(
  options: RedisSessionStoreOptions = {}
): SessionStore {
  return new RedisSessionStoreAdapter(options);
}
