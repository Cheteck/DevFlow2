import { z } from "zod";
import { createEnvHelper } from "@mosaix/config";

/**
 * @mosaix/core — Unified Env Manager combining Zod fail-fast validation with @mosaix/config robust helper
 */
export class EnvManager {
  private helper = createEnvHelper(process.env);
  private values: Record<string, unknown> = {};
  private validated = false;

  validate<T extends z.ZodRawShape>(schema: z.ZodObject<T>): z.infer<z.ZodObject<T>> {
    const result = schema.safeParse(process.env);
    if (!result.success) {
      const formattedErrors = result.error.format();
      throw new Error(
        `[Env] Environment variable validation failed (Fail-Fast):\n${JSON.stringify(formattedErrors, null, 2)}`
      );
    }
    this.values = result.data;
    this.validated = true;
    return result.data;
  }

  get<T = unknown, K extends string = string>(key: K, defaultValue?: unknown): T {
    if (this.validated && key in this.values) {
      return this.values[key] as T;
    }
    return this.helper(key, defaultValue as string) as T;
  }

  string(key: string, defaultValue?: string): string {
    return this.helper.string(key, defaultValue);
  }

  number(key: string, defaultValue?: number): number {
    return this.helper.number(key, defaultValue);
  }

  boolean(key: string, defaultValue?: boolean): boolean {
    return this.helper.boolean(key, defaultValue);
  }

  float(key: string, defaultValue?: number): number {
    return this.helper.float(key, defaultValue);
  }

  array(key: string, defaultValue?: readonly string[]): readonly string[] {
    return this.helper.array(key, defaultValue);
  }

  json(key: string, defaultValue?: unknown): unknown {
    return this.helper.json(key, defaultValue);
  }

  url(key: string, defaultValue?: string): string {
    return this.helper.url(key, defaultValue);
  }

  required(key: string): string {
    return this.helper.required(key);
  }
}

export const Env = new EnvManager();
