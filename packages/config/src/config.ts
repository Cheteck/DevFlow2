import { env } from "./env";

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    deepFreeze((obj as Record<string, unknown>)[key]);
  }
  return obj;
}

function getDottedValue(obj: unknown, key: string): unknown {
  const parts = key.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj));
}

export type ConfigEvent =
  | "reload" | "loaded" | "error" | "change" | "beforeReload";

type ConfigListener = (...args: unknown[]) => void;

export class ConfigManager {
  private configData: Record<string, unknown> = {};
  private currentVersion = 0;
  private readonly listeners = new Map<ConfigEvent, ConfigListener[]>();

  constructor() {}

  get version(): number {
    return this.currentVersion;
  }

  on(event: ConfigEvent, listener: ConfigListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  private emit(event: ConfigEvent, ...args: unknown[]): void {
    const list = this.listeners.get(event) ?? [];
    for (const listener of list) {
      try {
        listener(...args);
      } catch (err) {
        console.warn(`[ConfigManager] Exception inside listener for event '${event}': ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  /**
   * Loads the configuration from a raw object.
   */
  async load(data: Record<string, unknown>): Promise<void> {
    this.configData = deepFreeze(deepClone(data));
    this.currentVersion++;
    this.emit("loaded", this.configData);
  }

  get<T = unknown>(key: string, defaultValue?: T): T {
    const val = getDottedValue(this.configData, key);
    if (val === undefined) {
      return defaultValue as T;
    }
    return val as T;
  }

  has(key: string): boolean {
    return getDottedValue(this.configData, key) !== undefined;
  }

  all(): Record<string, unknown> {
    return this.configData;
  }

  namespace(prefix: string): Record<string, unknown> {
    const nsObj = getDottedValue(this.configData, prefix);
    if (nsObj === null || typeof nsObj !== "object") {
      return {};
    }
    return nsObj as Record<string, unknown>;
  }

  snapshot(): Record<string, unknown> {
    return deepClone(this.configData);
  }

  async reload(newData?: Record<string, unknown>): Promise<void> {
    this.emit("beforeReload");
    try {
      const backup = this.configData;
      const dataToLoad = newData ?? backup;

      const cloned = deepClone(dataToLoad);
      this.configData = deepFreeze(cloned);
      this.currentVersion++;

      this.emit("reload", this.configData);
      this.emit("change", this.configData);
    } catch (err) {
      this.emit("error", err);
      throw err;
    }
  }
}

export const Config = new ConfigManager();

export function config<T = unknown>(key: string, defaultValue?: T): T {
  return Config.get<T>(key, defaultValue);
}

export { env };
