/**
 * @mosaix/contracts — Versioned UI Experience & Slot Contracts (Phase 1)
 */

export interface ExperienceSlot {
  id: string;
  slotName: string;
  contractVersion: "1.0.0";
  ownerApp: string;
  requiredPermission?: string;
}

export interface ExperienceContract {
  id: string;
  contractVersion: "1.0.0";
  name: string;
  ownerApp: string;
  routes?: Array<{ path: string; title: string }>;
  slots?: ExperienceSlot[];
  requiredCapabilities?: string[];
}
