/**
 * @mosaix/core — ThemeTargetRegistry (THEME-04)
 *
 * The single, bootstrap-only registry of themeable target types. A project
 * declares WHICH target types accept a theme and with which capabilities
 * (`userSelectable` / `adminConfigurable`) via two surfaces that feed the
 * SAME registry (D-16, PRD-0008 §4.2b):
 *
 *   1. declarative — constructor `initial` list (project theme manifest)
 *   2. programmatic — `register()` (SDK / dynamic needs)
 *
 * A registry is the single source for type-CAPABILITY declarations; it
 * performs NO theme resolution (D-10, INV-THEME-006: the registry resolves
 * nothing): the resolver in 02-03 never registers/creates targets — it only
 * consumes this registry (registration is bootstrap-only, D-16, invariant
 * #5). An unregistered target type is NOT an error — `get()`/`has()` return
 * undefined/false (D-17). The registry stores strings + booleans only and
 * never knows a concrete business entity (INV-THEME-002).
 *
 * Dependency direction: core → contracts (ids only); self-contained, no
 * imports. Consumers: ThemeResolver (02-03), project bootstrap.
 */

// PRD §4.2b — capabilities per target type. Two plain booleans, no business
// fields (INV-THEME-002); a missing flag yields `false`.
export interface ThemeTargetCapabilities {
  readonly userSelectable: boolean;
  readonly adminConfigurable: boolean;
}

// PRD §4.2b — a registration is type + capabilities.
export interface ThemeTargetRegistration {
  readonly type: string;
  readonly capabilities: ThemeTargetCapabilities;
}

/**
 * Registry of themeable target types.
 *
 * Both the declarative constructor list and programmatic `register()` feed
 * the SAME internal Map — there is never a second registry (D-16, roadmap
 * Phase 2 criterion #1). Registration is bootstrap-only: this class exposes
 * NO `resolve` method, so a resolver can never trigger a registration
 * implicitly. Lookups follow CONVENTIONS: unknown types return `undefined`,
 * never throw (D-17).
 */
export class ThemeTargetRegistry {
  private readonly types = new Map<string, ThemeTargetRegistration>();

  constructor(initial?: readonly ThemeTargetRegistration[]) {
    if (initial === undefined) return;
    for (const registration of initial) {
      // last-write-wins, consistent with register() — no "already registered" throw
      this.types.set(registration.type, registration);
    }
  }

  /**
   * Programmatic surface + the mutation shared by both surfaces.
   * last-write-wins (no throw — capability-registry convention, T2-01).
   */
  register(registration: ThemeTargetRegistration): void {
    this.types.set(registration.type, registration);
  }

  /** Returns the registration for the type, or undefined when unregistered (D-17). */
  get(type: string): ThemeTargetRegistration | undefined {
    return this.types.get(type);
  }

  /** Whether the type is registered. */
  has(type: string): boolean {
    return this.get(type) !== undefined;
  }

  /** All registrations as a snapshot copy (Map values). */
  list(): ThemeTargetRegistration[] {
    return Array.from(this.types.values());
  }

  /** Number of registered target types. */
  get size(): number {
    return this.types.size;
  }
}
