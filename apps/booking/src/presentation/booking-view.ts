/**
 * @apps/booking — Autonomous BAC View & Descriptor
 * Self-contained SSR presentation layer for MosaiX Booking (slots & reservations).
 */

import type { BacDescriptor, BacExecutionContext, BacRenderResult } from "@mosaix/contracts";
import { BookingPageView } from "./index.js";

export function createBookingDescriptor(): BacDescriptor {
  return {
    id: "@apps/booking",
    name: "Booking",
    version: "1.0.0",
    routePrefix: "/booking",
    icon: "📅",
    isEnabled: true,
    requiredPermissions: ["booking:create:reservation"],

    async isAvailable(): Promise<boolean> {
      return true;
    },

    async render(_context: BacExecutionContext): Promise<BacRenderResult> {
      return {
        contentHtml: BookingPageView.render(),
        pageTitle: "Booking — Planning & Rendez-vous",
      };
    },
  };
}
