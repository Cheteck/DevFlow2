/**
 * @apps/solara/frontend — UI slot contributions (social feed).
 * References social content and interactions only: referenced objects
 * (vendables, offers, spaces) stay ID references, never duplicated here
 * (responsibilities.md, ADR-0016).
 */

export interface SolaraSlotContribution {
  slot: string;
  applicationId: string;
  entrypoint: string;
  order?: number;
  permission?: string;
}

/**
 * Slots consumed by the shell / SlotRegistry.
 * The shell registers them (no runtime import of ui-runtime here :
 * this entrypoint stays dependency-free).
 */
export const solaraSlotContributions: SolaraSlotContribution[] = [
  {
    slot: "shell.app-card",
    applicationId: "@apps/solara",
    entrypoint: "./frontend/src/index.js",
    order: 20,
    permission: "solara:feed:read",
  },
  {
    slot: "solara.feed.card",
    applicationId: "@apps/solara",
    entrypoint: "./frontend/src/index.js",
    order: 10,
    permission: "solara:feed:read",
  },
  {
    slot: "solara.post.composer",
    applicationId: "@apps/solara",
    entrypoint: "./frontend/src/index.js",
    order: 20,
    permission: "solara:post:create",
  },
];
