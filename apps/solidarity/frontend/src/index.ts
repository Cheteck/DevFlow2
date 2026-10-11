/**
 * @apps/solidarity/frontend — UI slot contributions (coordination de crise).
 * Inspire de la maquette MosaiX-Solidarity-Maquette (Dashboard, besoins,
 * benevoles, HXL) mais re-exprime en conventions MosaiX :
 * SSR theme-tokens, aucune donnee personnelle, permissions declarees
 * dans mosaix.json, entrypoint dependency-free (pas d'import ui-runtime).
 */

export interface SolidaritySlotContribution {
  slot: string;
  applicationId: string;
  entrypoint: string;
  order?: number;
  permission?: string;
}

/**
 * Slots consommes par le shell / SlotRegistry.
 * L'entree reste sans dependance runtime : le shell les enregistre.
 */
export const solidaritySlotContributions: SolidaritySlotContribution[] = [
  {
    slot: "shell.app-card",
    applicationId: "@apps/solidarity",
    entrypoint: "./frontend/src/index.js",
    order: 40,
    permission: "solidarity:need:declare",
  },
  {
    slot: "solidarity.needs.board",
    applicationId: "@apps/solidarity",
    entrypoint: "./frontend/src/index.js",
    order: 10,
    permission: "solidarity:need:declare",
  },
  {
    slot: "solidarity.volunteers.board",
    applicationId: "@apps/solidarity",
    entrypoint: "./frontend/src/index.js",
    order: 20,
    permission: "solidarity:mission:manage",
  },
  {
    slot: "solidarity.reports.hxl",
    applicationId: "@apps/solidarity",
    entrypoint: "./frontend/src/index.js",
    order: 30,
    permission: "solidarity:distribution:confirm",
  },
];
