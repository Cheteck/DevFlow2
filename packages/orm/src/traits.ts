/**
 * @mosaix/orm — Model Traits and Mixins
 */

export class TimestampableTrait {
  createdAt!: Date;
  updatedAt!: Date;

  touch(): void {
    if (!this.createdAt) {
      this.createdAt = new Date();
    }
    this.updatedAt = new Date();
  }
}

export class SoftDeleteTrait {
  deletedAt?: Date | null;

  softDelete(): void {
    this.deletedAt = new Date();
  }

  restore(): void {
    this.deletedAt = null;
  }

  isDeleted(): boolean {
    return !!this.deletedAt;
  }
}

export interface TraitCtor {
  prototype: Record<string, unknown>;
}

/**
 * Helper to apply multiple trait classes/mixins to a target class prototype.
 */
export function applyTraits(
  targetClass: { prototype: Record<string, unknown> },
  traits: TraitCtor[],
): void {
  for (const trait of traits) {
    const proto = trait.prototype;
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key !== "constructor") {
        Object.defineProperty(
          targetClass.prototype,
          key,
          Object.getOwnPropertyDescriptor(proto, key) || Object.create(null)
        );
      }
    }
  }
}
