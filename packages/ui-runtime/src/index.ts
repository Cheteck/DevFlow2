/**
 * @mosaix/ui-runtime — Unified Experience Composition and UI Slot Registry
 */

export interface UISlotContribution {
  slot: string;
  applicationId: string;
  entrypoint: string;
  order?: number;
  permission?: string;
  [key: string]: unknown;
}

export class SlotRegistry {
  private contributions: UISlotContribution[] = [];

  register(contribution: UISlotContribution): void {
    this.contributions.push(contribution);
  }

  getSlotContributions(slotId: string): UISlotContribution[] {
    return this.contributions
      .filter((c) => c.slot === slotId)
      .sort((a, b) => (a.order ?? 10) - (b.order ?? 10));
  }

  clear(): void {
    this.contributions = [];
  }
}
