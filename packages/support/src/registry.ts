export interface TypedRegistryOptions {
  name?: string;
  allowOverwrite?: boolean;
}

export interface TypedRegistry<K extends string | number | symbol, V> {
  register(key: K, value: V, allowOverwrite?: boolean): void;
  get(key: K): V | undefined;
  has(key: K): boolean;
  clear(): void;
  resetToDefaults(): void;
  size(): number;
  keys(): K[];
}

export function createTypedRegistry<K extends string | number | symbol, V>(
  defaults: Array<[K, V]> = [],
  options: TypedRegistryOptions = {},
): TypedRegistry<K, V> {
  const map = new Map<K, V>(defaults);
  const defaultEntries: Array<[K, V]> = [...defaults];
  const registryName = options.name ?? "TypedRegistry";
  const defaultAllowOverwrite = options.allowOverwrite ?? false;

  return {
    register(key: K, value: V, allowOverwrite = defaultAllowOverwrite): void {
      if (map.has(key) && !allowOverwrite) {
        throw new Error(
          `[${registryName}] Cannot register key "${String(key)}": key is already registered. Use allowOverwrite=true to explicitly override.`,
        );
      }
      map.set(key, value);
    },

    get(key: K): V | undefined {
      return map.get(key);
    },

    has(key: K): boolean {
      return map.has(key);
    },

    clear(): void {
      map.clear();
    },

    resetToDefaults(): void {
      map.clear();
      for (const [k, v] of defaultEntries) {
        map.set(k, v);
      }
    },

    size(): number {
      return map.size;
    },

    keys(): K[] {
      return Array.from(map.keys());
    },
  };
}
