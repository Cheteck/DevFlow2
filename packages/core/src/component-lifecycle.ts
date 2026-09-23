/**
 * @mosaix/core — Universal Runtime Component Lifecycle Engine
 * Unified lifecycle engine managing Plugins, BACs, Capabilities, and Adapters.
 *
 * @deprecated La source unique est `AppLifecycle` (lifecycle.ts). Ce moteur est
 * conservé comme vue compat pour `application-runtime.ts` et `plugins/*` ;
 * les transitions sont désormais gardées (voir ALLOWED ci-dessous).
 */
import { LifecycleError } from "./kernel-errors";

export type RuntimeComponentType = "plugin" | "bac" | "capability" | "adapter";

export type ComponentState =
  | "DISCOVERED"
  | "VALIDATED"
  | "RESOLVED"
  | "LOADED"
  | "INITIALIZED"
  | "ACTIVE"
  | "DISABLED";

export interface RuntimeComponent {
  id: string;
  name: string;
  version: string;
  type: RuntimeComponentType;
  state: ComponentState;
  metadata?: Record<string, unknown>;
}

export class RuntimeComponentLifecycleEngine {
  private components = new Map<string, RuntimeComponent>();

  registerComponent(component: Omit<RuntimeComponent, "state">): RuntimeComponent {
    const item: RuntimeComponent = {
      ...component,
      state: "DISCOVERED",
    };
    this.components.set(item.id, item);
    return item;
  }

  transitionTo(id: string, targetState: ComponentState): RuntimeComponent {
    const comp = this.components.get(id);
    if (!comp) {
      throw new LifecycleError(`Runtime component [${id}] not found in lifecycle engine.`, { componentId: id });
    }
    // Garde minimale : la source unique est AppLifecycle (lifecycle.ts TRANSITIONS).
    // Ce moteur est déprécié — les transitions illégales DISCOVERED→ACTIVE direct
    // sont rejetées pour éviter le split-brain avec AppLifecycle.
    const ALLOWED: Record<ComponentState, readonly ComponentState[]> = {
      DISCOVERED: ["VALIDATED", "DISABLED"],
      VALIDATED: ["RESOLVED", "DISABLED"],
      RESOLVED: ["LOADED", "DISABLED"],
      LOADED: ["INITIALIZED", "DISABLED"],
      INITIALIZED: ["ACTIVE", "DISABLED"],
      ACTIVE: ["DISABLED"],
      DISABLED: [],
    };
    if (!ALLOWED[comp.state].includes(targetState)) {
      throw new LifecycleError(
        `Invalid component transition: ${comp.state} → ${targetState} (component ${id})`,
        { from: comp.state, to: targetState },
      );
    }
    comp.state = targetState;
    return comp;
  }

  getComponent(id: string): RuntimeComponent | undefined {
    return this.components.get(id);
  }

  listComponents(type?: RuntimeComponentType): RuntimeComponent[] {
    const all = Array.from(this.components.values());
    return type ? all.filter((c) => c.type === type) : all;
  }

  clear(): void {
    this.components.clear();
  }
}

export const runtimeLifecycleEngine = new RuntimeComponentLifecycleEngine();
