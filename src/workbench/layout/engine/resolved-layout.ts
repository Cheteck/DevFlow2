/**
 * @mosaix/workbench — Resolved Layout Types
 *
 * Modèles de sortie de la résolution de layout.
 *
 * Une résolution transforme :
 * - une WorkbenchConfiguration (régions, layouts, presets déclarés) ;
 * - des contributions enregistrées (placements ciblant des surfaces) ;
 * en une composition résolue : pour chaque région active, la liste ordonnée
 * des placements avec leur contribution associée.
 *
 * Indépendant du DOM et du Rendering Adapter.
 */

import type { ContributionContract, PlacementContract } from "@mosaix/contracts";
import type { WorkbenchRegion } from "@mosaix/workbench/core/contracts/workbench-configuration.js";

/**
 * Placement résolu : un placement de contribution avec son ordre final et
 * son état d'affichage.
 */
export interface ResolvedPlacement {
  /** Placement déclaratif validé. */
  placement: PlacementContract;
  /** Contribution associée au placement. */
  contribution: ContributionContract;
  /** Ordre de présentation résolu (plus petit = affiché en premier). */
  order: number;
  /** Indique si l'ordre provient d'un champ contractuel explicite. */
  orderExplicit: boolean;
  /** Le placement est-il masqué (hidden) ? */
  hidden: boolean;
}

/**
 * Région résolue : une région de composition avec ses placements ordonnés.
 */
export interface ResolvedRegion {
  id: string;
  label: string;
  surfaceId: string;
  ownedBy: WorkbenchRegion["ownedBy"];
  placements: ResolvedPlacement[];
}

/**
 * Layout résolu : un layout avec ses régions actives et leurs placements.
 */
export interface ResolvedLayout {
  layoutId: string;
  presetId?: string;
  regions: ResolvedRegion[];
}
