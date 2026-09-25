export interface CachePort {
  get<T = unknown>(key: string): Promise<T | null | undefined>;
  set<T = unknown>(key: string, value: T, options?: { ttl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  clear?(): Promise<void>;
}
