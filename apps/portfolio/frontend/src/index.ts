/**
 * @apps/portfolio/frontend — UI slot contributions (PIM).
 * Contributes catalog entry points without duplicating commercial data :
 * no price, stock or availability is ever rendered here (responsibilities.md).
 */

export interface PortfolioSlotContribution {
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
export const portfolioSlotContributions: PortfolioSlotContribution[] = [
  {
    slot: "shell.app-card",
    applicationId: "@apps/portfolio",
    entrypoint: "./frontend/src/index.js",
    order: 30,
    permission: "portfolio:vendable:read:tenant",
  },
  {
    slot: "portfolio.vendable.card",
    applicationId: "@apps/portfolio",
    entrypoint: "./frontend/src/index.js",
    order: 10,
    permission: "portfolio:vendable:read:tenant",
  },
  {
    slot: "portfolio.vendable.quality",
    applicationId: "@apps/portfolio",
    entrypoint: "./frontend/src/index.js",
    order: 20,
    permission: "portfolio:vendable:read:tenant",
  },
];
