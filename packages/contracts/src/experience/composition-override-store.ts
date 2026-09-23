/**
 * @mosaix/contracts — Composition Override Store
 * Stores Live Block Editor customizations (order, grid span, wrapper, visibility) per surface & slot.
 */

import type { BlockWrapperConfig, BlockWrapperType } from "./block-wrapper-contract";

export interface BlockPlacementOverride {
  contributionId: string;
  placementId: string;
  order: number;
  gridSpan: number; // 1 to 12
  wrapper: BlockWrapperType | BlockWrapperConfig;
  enabled: boolean;
  styleOverrides?: Record<string, string>;
}

export interface SlotOverride {
  slotId: string;
  columns?: 1 | 2 | 3 | 4 | 6 | 12;
  gap?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
  blocks: BlockPlacementOverride[];
}

export interface CompositionOverrideStore {
  surfaceId: string;
  updatedAt: number;
  updatedBy?: string;
  slotOverrides: Record<string, SlotOverride>;
}
