/**
 * @mosaix/contracts — Composition Snapshot
 * Immutable result of a deterministic resolution pipeline consumed by the Shell.
 */

import type { CompositionContext } from "./composition-context";
import type { SurfaceContract } from "./surface-contract";
import type { SlotContract } from "./slot-contract";
import type { ContributionContract } from "./contribution-contract";

import type { BlockWrapperConfig, BlockWrapperType } from "./block-wrapper-contract";

export type RejectionReason =
  | "INVALID_CONTRACT"
  | "MISSING_CAPABILITY"
  | "MISSING_PERMISSION"
  | "TENANT_NOT_ALLOWED"
  | "CONTEXT_NOT_MATCHED"
  | "ROUTE_NOT_MATCHED"
  | "POLICY_REJECTED"
  | "PLACEMENT_CONFLICT";

export interface RejectionDetail {
  contributionId: string;
  placementId?: string;
  reason: RejectionReason;
  message?: string;
}

export type ContributionState = "registered" | "eligible" | "visible" | "active";

export interface ResolvedPlacement {
  placementId: string;
  surfaceId: string;
  slotId: string;
  order: number;
  priority: number;
  gridSpan?: number; // 1 to 12
  wrapper?: BlockWrapperType | BlockWrapperConfig;
  hidden?: boolean;
  overridden?: boolean;
  contribution: ContributionContract;
  state: ContributionState;
}

export interface CompositionSnapshot {
  timestamp: number;
  route: string;
  context: CompositionContext;
  surfaces: SurfaceContract[];
  slots: SlotContract[];
  activePlacementsBySlot: Record<string, ResolvedPlacement[]>;
  activeContributions: ContributionContract[];
  rejectedContributions: RejectionDetail[];
  metrics: {
    registeredCount: number;
    eligibleCount: number;
    visibleCount: number;
    activeCount: number;
    rejectedCount: number;
  };
}
