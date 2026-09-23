type EnvSource = Record<string, string | undefined>;

export function createEnvHelper(source: EnvSource = process.env) {
  function env(key: string, defaultValue?: string): string | undefined {
    return source[key] ?? defaultValue;
  }

  env.string = (key: string, defaultValue?: string): string => {
    const val = source[key] ?? defaultValue;
    if (val === undefined) return "";
    return String(val);
  };

  env.number = (key: string, defaultValue?: number): number => {
    const val = source[key];
    if (val === undefined) {
      if (defaultValue !== undefined) return defaultValue;
      return 0;
    }
    const num = Number.parseInt(val, 10);
    if (Number.isNaN(num)) {
      if (defaultValue !== undefined) return defaultValue;
      return 0;
    }
    return num;
  };

  env.boolean = (key: string, defaultValue?: boolean): boolean => {
    const val = source[key];
    if (val === undefined) {
      if (defaultValue !== undefined) return defaultValue;
      return false;
    }
    const lower = val.toLowerCase().trim();
    if (lower === "true" || lower === "1" || lower === "yes" || lower === "on")
      return true;
    if (lower === "false" || lower === "0" || lower === "no" || lower === "off")
      return false;
    return Boolean(val);
  };

  env.float = (key: string, defaultValue?: number): number => {
    const val = source[key];
    if (val === undefined) {
      if (defaultValue !== undefined) return defaultValue;
      return 0.0;
    }
    const num = Number.parseFloat(val);
    if (Number.isNaN(num)) {
      if (defaultValue !== undefined) return defaultValue;
      return 0.0;
    }
    return num;
  };

  env.array = (
    key: string,
    defaultValue?: readonly string[],
  ): readonly string[] => {
    const val = source[key];
    if (val === undefined) {
      return defaultValue ?? [];
    }
    return val
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  env.json = (key: string, defaultValue?: unknown): unknown => {
    const val = source[key];
    if (val === undefined) {
      return defaultValue;
    }
    try {
      return JSON.parse(val);
    } catch {
      return defaultValue;
    }
  };

  env.date = (key: string, defaultValue?: Date): Date => {
    const val = source[key];
    if (val === undefined) {
      return defaultValue ?? new Date();
    }
    const parsed = new Date(val);
    if (Number.isNaN(parsed.getTime())) {
      return defaultValue ?? new Date();
    }
    return parsed;
  };

  env.url = (key: string, defaultValue?: string): string => {
    const val = source[key] ?? defaultValue;
    if (val === undefined) return "";
    try {
      new URL(val);
      return val;
    } catch {
      throw new Error(
        `Environment variable "${key}" is not a valid URL: ${val}`,
      );
    }
  };

  env.required = (key: string): string => {
    const val = source[key];
    if (val === undefined || val === "") {
      throw new Error(`Environment variable "${key}" is required but missing`);
    }
    return val;
  };

  env.enum = (
    key: string,
    values: readonly string[],
    defaultValue?: string,
  ): string => {
    const val = source[key] ?? defaultValue;
    if (val === undefined) {
      throw new Error(
        `Environment variable "${key}" is missing and has no valid default`,
      );
    }
    if (!values.includes(val)) {
      throw new Error(
        `Environment variable "${key}" value "${val}" must be one of: ${values.join(", ")}`,
      );
    }
    return val;
  };

  env.min = (key: string, minVal: number, defaultValue?: number): number => {
    const num = env.number(key, defaultValue);
    if (num < minVal) {
      throw new Error(
        `Environment variable "${key}" value ${num} must be at least ${minVal}`,
      );
    }
    return num;
  };

  env.max = (key: string, maxVal: number, defaultValue?: number): number => {
    const num = env.number(key, defaultValue);
    if (num > maxVal) {
      throw new Error(
        `Environment variable "${key}" value ${num} must be at most ${maxVal}`,
      );
    }
    return num;
  };

  env.regex = (key: string, pattern: RegExp, defaultValue?: string): string => {
    const val = source[key] ?? defaultValue;
    if (val === undefined) {
      throw new Error(
        `Environment variable "${key}" is missing and has no default value`,
      );
    }
    if (!pattern.test(val)) {
      throw new Error(
        `Environment variable "${key}" value "${val}" does not match pattern ${pattern}`,
      );
    }
    return val;
  };

  return env;
}

export const env = createEnvHelper();
