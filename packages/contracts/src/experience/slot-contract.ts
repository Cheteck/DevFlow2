/**
 * @mosaix/contracts — Slot Contract
 * Pure declarative point of extension within a Surface.
 */

import type { ExperienceKind } from "./contribution-contract";

export interface SlotContract {
  id: string;
  surfaceId: string;
  accepts: ExperienceKind[];
  layout?: "single" | "stack" | "grid" | "flex" | "overflow";
  columns?: 1 | 2 | 3 | 4 | 6 | 12;
  gap?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
  description?: string;
}
