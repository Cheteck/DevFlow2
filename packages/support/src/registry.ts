export interface TypedRegistryOptions {
  name?: string;
}

export interface TypedRegistry<K extends string | number | symbol, V> {
  register(key: K, value: V): void;
  override(key: K, value: V): void;
  get(key: K): V | undefined;
  has(key: K): boolean;
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

  return {
    register(key: K, value: V): void {
      if (map.has(key)) {
        throw new Error(
          `[${registryName}] Cannot register key "${String(key)}": key is already registered. Use override() to explicitly replace an existing entry.`,
        );
      }
      map.set(key, value);
    },

    override(key: K, value: V): void {
      map.set(key, value);
    },

    get(key: K): V | undefined {
      return map.get(key);
    },

    has(key: K): boolean {
      return map.has(key);
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
