/**
 * @apps/citadelle/frontend — UI slot contributions (IAM).
 * Contributes shell + IAM slot entrypoints without duplicating identity data.
 * No runtime import of ui-runtime here: this entrypoint stays dependency-free
 * and the shell registers the contributions via the SlotRegistry.
 */

export interface CitadelleSlotContribution {
  slot: string;
  applicationId: string;
  entrypoint: string;
  order?: number;
  permission?: string;
}

/**
 * Slots consumed by the shell / ui-runtime SlotRegistry.
 * The shell registers them (no runtime import of ui-runtime here :
 * this entrypoint stays dependency-free).
 */
export const citadelleSlotContributions: CitadelleSlotContribution[] = [
  {
    slot: "shell.app-card",
    applicationId: "@apps/citadelle",
    entrypoint: "./frontend/src/index.js",
    order: 35,
    permission: "citadelle:user:read:tenant",
  },
  {
    slot: "citadelle.iam.profile",
    applicationId: "@apps/citadelle",
    entrypoint: "./frontend/src/index.js",
    order: 10,
    permission: "citadelle:user:read:tenant",
  },
  {
    slot: "citadelle.iam.security",
    applicationId: "@apps/citadelle",
    entrypoint: "./frontend/src/index.js",
    order: 20,
    permission: "citadelle:user:read:tenant",
  },
  {
    slot: "citadelle.iam.users",
    applicationId: "@apps/citadelle",
    entrypoint: "./frontend/src/index.js",
    order: 30,
    permission: "citadelle:user:create:tenant",
  },
];