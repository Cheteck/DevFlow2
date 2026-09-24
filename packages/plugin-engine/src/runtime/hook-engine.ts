/**
 * @mosaix/plugin-engine/runtime — Hook Execution Engine
 */

export type HookHandler<T = unknown, R = unknown> = (payload: T, context?: unknown) => Promise<R> | R;

export interface RegisteredHook {
  id: string;
  point: string;
  pluginId?: string;
  priority: number;
  handler: HookHandler<unknown, unknown>;
}

export type HookExecutionMode = "waterfall" | "parallel" | "bail";

export interface HookExecutionOptions {
  mode?: HookExecutionMode;
  timeoutMs?: number;
  stopOnError?: boolean;
}

export interface HookExecutionResult<R = unknown> {
  point: string;
  results: R[];
  waterfallResult?: unknown;
  bailResult?: R;
  errors: Array<{ pluginId?: string; error: Error }>;
  durationMs: number;
}

export class HookExecutionEngine {
  private hooks = new Map<string, RegisteredHook[]>();

  /**
   * Register a hook for a given extension point
   */
  registerHook<T = unknown, R = unknown>(
    point: string,
    handler: HookHandler<T, R>,
    options?: { priority?: number; pluginId?: string; id?: string }
  ): string {
    const hookId = options?.id ?? `hook_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const registered: RegisteredHook = {
      id: hookId,
      point,
      pluginId: options?.pluginId,
      priority: options?.priority ?? 100,
      handler,
    };

    if (!this.hooks.has(point)) {
      this.hooks.set(point, []);
    }

    const list = this.hooks.get(point)!;
    list.push(registered);
    // Sort descending by priority (higher priority executed first)
    list.sort((a, b) => b.priority - a.priority);

    return hookId;
  }

  /**
   * Unregister a hook by ID or point + pluginId
   */
  unregisterHook(hookId: string): boolean {
    let found = false;
    for (const [point, list] of this.hooks.entries()) {
      const idx = list.findIndex((h) => h.id === hookId);
      if (idx !== -1) {
        list.splice(idx, 1);
        if (list.length === 0) {
          this.hooks.delete(point);
        }
        found = true;
        break;
      }
    }
    return found;
  }

  /**
   * Unregister all hooks registered by a specific plugin
   */
  unregisterPluginHooks(pluginId: string): number {
    let removed = 0;
    for (const [point, list] of this.hooks.entries()) {
      const filtered = list.filter((h) => h.pluginId !== pluginId);
      removed += list.length - filtered.length;
      if (filtered.length === 0) {
        this.hooks.delete(point);
      } else {
        this.hooks.set(point, filtered);
      }
    }
    return removed;
  }

  /**
   * Run all hooks attached to an extension point
   */
  async runHook<T = unknown, R = unknown>(
    point: string,
    args: T,
    options?: HookExecutionOptions,
    context?: unknown
  ): Promise<HookExecutionResult<R>> {
    const start = performance.now();
    const mode = options?.mode ?? "parallel";
    const timeoutMs = options?.timeoutMs ?? 5000;
    const stopOnError = options?.stopOnError ?? false;

    const list = this.hooks.get(point) ?? [];
    const results: R[] = [];
    const errors: Array<{ pluginId?: string; error: Error }> = [];
    let waterfallValue: unknown = args;
    let bailValue: R | undefined = undefined;

    const executeWithTimeout = async (hook: RegisteredHook, payload: unknown): Promise<R> => {
      let timer: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Hook execution timed out after ${timeoutMs}ms on point [${point}] for plugin [${hook.pluginId ?? "anonymous"}]`));
        }, timeoutMs);
      });

      try {
        const resultPromise = Promise.resolve(hook.handler(payload, context));
        const res = await Promise.race([resultPromise, timeoutPromise]);
        return res as R;
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    if (mode === "parallel") {
      const promises = list.map(async (hook) => {
        try {
          const res = await executeWithTimeout(hook, args);
          return { success: true, res, pluginId: hook.pluginId };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err : new Error(String(err)), pluginId: hook.pluginId };
        }
      });

      const settled = await Promise.all(promises);
      for (const item of settled) {
        if (item.success) {
          results.push(item.res as R);
        } else {
          errors.push({ pluginId: item.pluginId, error: item.error! });
          if (stopOnError) {
            throw item.error;
          }
        }
      }
    } else if (mode === "waterfall") {
      for (const hook of list) {
        try {
          const res = await executeWithTimeout(hook, waterfallValue);
          waterfallValue = res;
          results.push(res);
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          errors.push({ pluginId: hook.pluginId, error });
          if (stopOnError) {
            throw error;
          }
        }
      }
    } else if (mode === "bail") {
      for (const hook of list) {
        try {
          const res = await executeWithTimeout(hook, args);
          if (res !== undefined && res !== null) {
            bailValue = res;
            results.push(res);
            break; // Stop at first meaningful result
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          errors.push({ pluginId: hook.pluginId, error });
          if (stopOnError) {
            throw error;
          }
        }
      }
    }

    return {
      point,
      results,
      waterfallResult: waterfallValue,
      bailResult: bailValue,
      errors,
      durationMs: Math.round(performance.now() - start),
    };
  }

  getRegisteredPoints(): string[] {
    return Array.from(this.hooks.keys());
  }

  getHooksForPoint(point: string): readonly RegisteredHook[] {
    return this.hooks.get(point) ?? [];
  }
}
