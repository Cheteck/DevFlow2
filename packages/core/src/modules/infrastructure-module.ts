/**
 * @mosaix/core — Infrastructure Module (T-EXT-05)
 *
 * Enables composing infrastructure port adapters (Clock, ID, Config, Secrets,
 * Logging, Metrics, Tracing, Email, SMS, HTTP, EventStore, MessageBus, PubSub,
 * Crypto, Search, FeatureFlags, Database, Cache, Storage, IdentityStore,
 * SessionStore, CredentialStore, TokenStore) into the RuntimeKernel.
 * Adapters are registered into the KernelContext and resolved via
 * `ctx.getService<T>(name)`.
 */

import type { KernelContext, KernelModule } from "../kernel-module";

export interface ClockPortLike {
  now(): Date | string | number;
}

export interface IdGeneratorPortLike {
  generate(prefix?: string): string;
}

export interface ConfigPortLike {
  get<T = unknown>(key: string, defaultValue?: T): T;
  has?(key: string): boolean;
}

export interface SecretsPortLike {
  getSecret(key: string): Promise<string | null> | string | null;
}

export interface LoggingPortLike {
  info(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  debug?(msg: string, ...args: unknown[]): void;
}

export interface MetricsPortLike {
  increment?(name: string, value?: number, tags?: Record<string, string>): void;
  gauge?(name: string, value: number, tags?: Record<string, string>): void;
  histogram?(name: string, value: number, tags?: Record<string, string>): void;
}

export interface TracingPortLike {
  startSpan?(name: string, parent?: unknown): unknown;
}

export interface EmailPortLike {
  send(options: { to: string; subject: string; body?: string; html?: string }): Promise<unknown>;
}

export interface SmsPortLike {
  send(options: { to: string; message: string }): Promise<unknown>;
}

export interface HttpPortLike {
  fetch?(url: string, init?: unknown): Promise<unknown>;
  request?(options: unknown): Promise<unknown>;
}

export interface EventStorePortLike {
  append(envelope: unknown): Promise<unknown> | unknown;
  query?(filter?: unknown): Promise<unknown[]> | unknown[];
}

export interface MessageBusPortLike {
  publish(topic: string, message: unknown): Promise<void> | void;
  subscribe?(topic: string, handler: (message: unknown) => Promise<void> | void): () => void;
}

export interface PubSubPortLike {
  publish(topic: string, message: unknown): Promise<void> | void;
  subscribe?(topic: string, handler: (message: unknown) => Promise<void> | void): () => void;
}

export interface CryptoPortLike {
  hash?(data: string, algorithm?: string): Promise<string> | string;
  encrypt?(data: string, key?: string): Promise<string> | string;
  decrypt?(data: string, key?: string): Promise<string> | string;
}

export interface SearchPortLike {
  search(query: string, options?: unknown): Promise<unknown[]> | unknown[];
  index?(document: unknown): Promise<void> | void;
}

export interface FeatureFlagsPortLike {
  isEnabled(flag: string, context?: unknown): Promise<boolean> | boolean;
}

export interface DatabasePortLike {
  query?(sqlOrQuery: unknown, params?: unknown[]): Promise<unknown> | unknown;
  transaction?<T>(fn: (tx: unknown) => Promise<T>): Promise<T>;
}

export interface CachePortLike {
  get<T = unknown>(key: string): Promise<T | null> | T | null;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void> | void;
  delete?(key: string): Promise<void> | void;
}

export interface StoragePortLike {
  put(path: string, content: unknown): Promise<unknown> | unknown;
  get?(path: string): Promise<unknown> | unknown;
  delete?(path: string): Promise<void> | void;
}

export interface IdentityStorePortLike {
  findUserById?(id: string): Promise<unknown> | unknown;
}

export interface SessionStorePortLike {
  getSession?(id: string): Promise<unknown> | unknown;
}

export interface CredentialStorePortLike {
  getCredentials?(id: string): Promise<unknown> | unknown;
}

export interface TokenStorePortLike {
  verifyToken?(token: string): Promise<unknown> | unknown;
}

export interface InfrastructureModuleOptions {
  clock?: ClockPortLike | unknown;
  id?: IdGeneratorPortLike | unknown;
  config?: ConfigPortLike | unknown;
  secrets?: SecretsPortLike | unknown;
  logging?: LoggingPortLike | unknown;
  metrics?: MetricsPortLike | unknown;
  tracing?: TracingPortLike | unknown;
  email?: EmailPortLike | unknown;
  sms?: SmsPortLike | unknown;
  http?: HttpPortLike | unknown;
  eventStore?: EventStorePortLike | unknown;
  messageBus?: MessageBusPortLike | unknown;
  pubsub?: PubSubPortLike | unknown;
  crypto?: CryptoPortLike | unknown;
  search?: SearchPortLike | unknown;
  featureFlags?: FeatureFlagsPortLike | unknown;
  database?: DatabasePortLike | unknown;
  cache?: CachePortLike | unknown;
  storage?: StoragePortLike | unknown;
  identityStore?: IdentityStorePortLike | unknown;
  sessionStore?: SessionStorePortLike | unknown;
  credentialStore?: CredentialStorePortLike | unknown;
  tokenStore?: TokenStorePortLike | unknown;
  [customService: string]: unknown;
}

export class InfrastructureModule implements KernelModule {
  readonly name = "infrastructure";
  readonly version = "1.0.0";

  constructor(private readonly options: InfrastructureModuleOptions = {}) {}

  register(ctx: KernelContext): void {
    const services: Record<string, unknown> = {};

    const knownKeys: (keyof InfrastructureModuleOptions)[] = [
      "clock",
      "id",
      "config",
      "secrets",
      "logging",
      "metrics",
      "tracing",
      "email",
      "sms",
      "http",
      "eventStore",
      "messageBus",
      "pubsub",
      "crypto",
      "search",
      "featureFlags",
      "database",
      "cache",
      "storage",
      "identityStore",
      "sessionStore",
      "credentialStore",
      "tokenStore",
    ];

    for (const key of knownKeys) {
      if (this.options[key] !== undefined) {
        services[key] = this.options[key];
      }
    }

    for (const [key, val] of Object.entries(this.options)) {
      if (val !== undefined && !(key in services)) {
        services[key] = val;
      }
    }

    for (const [serviceName, instance] of Object.entries(services)) {
      if (instance !== undefined) {
        ctx.setService(serviceName, instance);
      }
    }
  }
}
