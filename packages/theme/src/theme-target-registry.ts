/**
 * @mosaix/theme — ThemeTargetRegistry
 */

export interface ThemeTargetCapabilities {
  readonly userSelectable: boolean;
  readonly adminConfigurable: boolean;
}

export interface ThemeTargetRegistration {
  readonly type: string;
  readonly capabilities: ThemeTargetCapabilities;
}

export class ThemeTargetRegistry {
  private readonly types = new Map<string, ThemeTargetRegistration>();

  constructor(initial?: readonly ThemeTargetRegistration[]) {
    if (initial === undefined) return;
    for (const registration of initial) {
      this.types.set(registration.type, registration);
    }
  }

  register(registration: ThemeTargetRegistration): void {
    this.types.set(registration.type, registration);
  }

  get(type: string): ThemeTargetRegistration | undefined {
    return this.types.get(type);
  }

  has(type: string): boolean {
    return this.get(type) !== undefined;
  }

  list(): ThemeTargetRegistration[] {
    return Array.from(this.types.values());
  }

  get size(): number {
    return this.types.size;
  }
}
