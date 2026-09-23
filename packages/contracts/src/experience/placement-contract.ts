/**
 * @mosaix/contracts — Placement Contract
 * Defines where a Contribution is projected (surface + slot couple).
 */

import type { BlockWrapperConfig, BlockWrapperType } from "./block-wrapper-contract";

export interface PlacementContract {
  id: string;
  surfaceId: string;
  slotId: string;
  order?: number;
  priority?: number;
  gridSpan?: number; // 1 to 12 columns
  responsiveSpan?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  wrapper?: BlockWrapperType | BlockWrapperConfig;
  hidden?: boolean;
  payload?: Record<string, unknown>;
}
