/**
 * @mosaix/container — Official IoC Container (Phase 2)
 */

export type InjectionToken<T = unknown> = string | symbol | (new (...args: unknown[]) => T);

export type Factory<T = unknown> = (
  container: Container,
  ...parameters: unknown[]
) => T;

export interface Binding {
  concrete: Factory | unknown;
  shared: boolean;
  scoped: boolean;
}

function tokenToString(token: InjectionToken): string {
  if (typeof token === "symbol") return token.toString();
  if (typeof token === "function") return token.name || "AnonymousClass";
  return token;
}

export class Container {
  readonly parent: Container | undefined;
  private bindings = new Map<string, Binding>();
  private instances = new Map<string, unknown>();
  private scopedInstances = new Map<string, unknown>();

  constructor(parent?: Container) {
    if (parent !== undefined) {
      this.parent = parent;
    }
  }

  bind<T>(token: InjectionToken<T>, concrete: Factory<T>, shared?: boolean, scoped?: boolean): void;
  bind<T>(token: InjectionToken<T>, concrete: unknown, shared?: boolean, scoped?: boolean): void;
  bind<T>(
    token: InjectionToken<T>,
    concrete: Factory<T> | unknown,
    shared = false,
    scoped = false,
  ): void {
    const key = tokenToString(token);
    this.bindings.set(key, { concrete, shared, scoped });
  }

  singleton<T>(token: InjectionToken<T>, concrete: Factory<T>): void;
  singleton<T>(token: InjectionToken<T>, concrete: unknown): void;
  singleton<T>(token: InjectionToken<T>, concrete: Factory<T> | unknown): void {
    this.bind(token, concrete as Factory<T>, true, false);
  }

  scoped<T>(token: InjectionToken<T>, concrete: Factory<T>): void;
  scoped<T>(token: InjectionToken<T>, concrete: unknown): void;
  scoped<T>(token: InjectionToken<T>, concrete: Factory<T> | unknown): void {
    this.bind(token, concrete as Factory<T>, true, true);
  }

  instance<T>(token: InjectionToken<T>, instance: T): void {
    const key = tokenToString(token);
    this.instances.set(key, instance);
  }

  has(token: InjectionToken): boolean {
    const key = tokenToString(token);
    if (this.instances.has(key) || this.bindings.has(key)) {
      return true;
    }
    return this.parent !== undefined ? this.parent.has(token) : false;
  }

  make<T = unknown>(token: InjectionToken<T>, ...parameters: unknown[]): T {
    return this.resolve<T>(token, this, ...parameters);
  }

  resolve<T = unknown>(
    token: InjectionToken<T>,
    origin: Container = this,
    ...parameters: unknown[]
  ): T {
    const key = tokenToString(token);

    if (this.instances.has(key)) {
      return this.instances.get(key) as T;
    }

    if (origin.scopedInstances.has(key)) {
      return origin.scopedInstances.get(key) as T;
    }

    const binding = this.bindings.get(key);

    if (binding === undefined) {
      if (typeof token === "function") {
        try {
          const Ctor = token as new (...args: unknown[]) => T;
          return new Ctor(...parameters);
        } catch (err) {
          console.warn(`[Container] Failed auto-instantiation of unbound constructor [${key}]: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      if (this.parent !== undefined) {
        return this.parent.resolve<T>(token, origin, ...parameters);
      }
      throw new Error(`Target [${key}] is not bound in the container.`);
    }

    const { concrete, shared, scoped } = binding;

    let resolved: unknown;
    if (typeof concrete === "function") {
      try {
        resolved = (concrete as Factory)(origin, ...parameters);
      } catch (error) {
        throw new Error(
          `Failed to resolve [${key}]: ${(error as Error).message}`,
          { cause: error },
        );
      }
    } else {
      resolved = concrete;
    }

    if (shared) {
      if (scoped) {
        origin.scopedInstances.set(key, resolved);
      } else {
        this.instances.set(key, resolved);
      }
    }

    return resolved as T;
  }

  createChild(): Container {
    return new Container(this);
  }

  flush(): void {
    this.bindings.clear();
    this.instances.clear();
    this.scopedInstances.clear();
  }
}

export interface ServiceProvider {
  register(container: Container): void | Promise<void>;
  boot?(container: Container, router?: unknown): void | Promise<void>;
}

/**
 * Global Container Singleton (canonical source for IoC resolution)
 */
export const container = new Container();
