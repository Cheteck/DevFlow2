/**
 * @mosaix/contracts — Surface Contract
 * Pure declarative contract describing a composition region and its slots.
 */

import type { SlotContract } from "./slot-contract";

export interface SurfaceContract {
  id: string;
  kind: "structural" | "contextual";
  ownedBy: "shell" | "application";
  label: string;
  slots: SlotContract[];
  description?: string;
}
