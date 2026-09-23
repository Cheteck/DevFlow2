/**
 * Layout contract — how an application composes regions with widgets.
 */

export type LayoutRegion = "header" | "sidebar" | "main" | "footer" | "modal";

export interface LayoutSlot {
  region: LayoutRegion;
  /** Rendering order within the region. */
  order: number;
  /** Widget id rendered in this slot. */
  widgetId: string;
}

export interface LayoutContract {
  id: string;
  slots: LayoutSlot[];
}
