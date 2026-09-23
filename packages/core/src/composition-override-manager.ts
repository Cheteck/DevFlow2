/**
 * @mosaix/core — Composition Override Manager
 * Manages live overrides for UI slots, grid spans, and block wrappers (CS-Cart UniTheme Live Editor engine).
 */

import type {
  CompositionOverrideStore,
  BlockPlacementOverride,
  ResolvedPlacement,
  CompositionSnapshot,
} from "@mosaix/contracts";

export class CompositionOverrideManager {
  private storesBySurface: Map<string, CompositionOverrideStore> = new Map();

  /**
   * Get store for surface
   */
  getStore(surfaceId: string): CompositionOverrideStore {
    let store = this.storesBySurface.get(surfaceId);
    if (!store) {
      store = {
        surfaceId,
        updatedAt: Date.now(),
        slotOverrides: {},
      };
      this.storesBySurface.set(surfaceId, store);
    }
    return store;
  }

  /**
   * Save or update an override for a block in a slot
   */
  setBlockOverride(
    surfaceId: string,
    slotId: string,
    override: BlockPlacementOverride
  ): CompositionOverrideStore {
    const store = this.getStore(surfaceId);
    let slotOverride = store.slotOverrides[slotId];
    if (!slotOverride) {
      slotOverride = {
        slotId,
        blocks: [],
      };
      store.slotOverrides[slotId] = slotOverride;
    }

    const existingIndex = slotOverride.blocks.findIndex(
      (b) => b.contributionId === override.contributionId
    );
    if (existingIndex >= 0) {
      slotOverride.blocks[existingIndex] = override;
    } else {
      slotOverride.blocks.push(override);
    }

    store.updatedAt = Date.now();
    return store;
  }

  /**
   * Remove override for a block
   */
  removeBlockOverride(surfaceId: string, slotId: string, contributionId: string): void {
    const store = this.storesBySurface.get(surfaceId);
    if (!store || !store.slotOverrides[slotId]) return;

    store.slotOverrides[slotId].blocks = store.slotOverrides[slotId].blocks.filter(
      (b) => b.contributionId !== contributionId
    );
    store.updatedAt = Date.now();
  }

  /**
   * Merge live overrides into a resolved CompositionSnapshot
   */
  applyOverrides(snapshot: CompositionSnapshot, surfaceId: string): CompositionSnapshot {
    const store = this.storesBySurface.get(surfaceId);
    if (!store) return snapshot;

    const updatedPlacementsBySlot: Record<string, ResolvedPlacement[]> = {
      ...snapshot.activePlacementsBySlot,
    };

    for (const [slotId, slotOverride] of Object.entries(store.slotOverrides)) {
      const placements = updatedPlacementsBySlot[slotId] ?? [];
      const overrideMap = new Map<string, BlockPlacementOverride>(
        slotOverride.blocks.map((b) => [b.contributionId, b])
      );

      const modifiedPlacements: ResolvedPlacement[] = placements
        .map((p) => {
          const ov = overrideMap.get(p.contribution.id);
          if (!ov) return p;

          return {
            ...p,
            order: ov.order,
            gridSpan: ov.gridSpan,
            wrapper: ov.wrapper,
            hidden: !ov.enabled,
            overridden: true,
          };
        })
        .filter((p) => !p.hidden);

      // Sort by order
      modifiedPlacements.sort((a, b) => a.order - b.order);
      updatedPlacementsBySlot[slotId] = modifiedPlacements;
    }

    return {
      ...snapshot,
      activePlacementsBySlot: updatedPlacementsBySlot,
    };
  }
}
