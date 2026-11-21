/**
 * @mosaix/workbench — Layout Engine
 *
 * Moteur de résolution de layout du Workbench.
 *
 * Transforme une WorkbenchConfiguration et des contributions enregistrées
 * en une composition résolue : pour chaque région active, la liste ordonnée
 * des placements avec leur contribution associée.
 *
 * Règles de résolution (déterministe) :
 * 1. Un preset sélectionne un layout et les régions actives ;
 * 2. Pour chaque région active, on filtre les contributions dont au moins
 *    un placement cible le surfaceId de la région ;
 * 3. Les placements hidden: true sont exclus ;
 * 4. Le tri se fait par order (placement.order), puis par identifiant de
 *    contribution comme critère secondaire stable ;
 * 5. L'ordre métier n'est jamais remplacé par un tri alphabétique arbitraire
 *    quand l'ordre est contractuellement défini.
 *
 * Indépendant du DOM, du Rendering Adapter et du Runtime MosaiX.
 * Aucune dépendance vers @mosaix/core.
 */

import type {
  ContributionContract,
  PlacementContract,
} from "@mosaix/contracts";
import type {
  WorkbenchConfiguration,
  WorkbenchRegion,
} from "@mosaix/workbench/core/contracts/workbench-configuration.js";
import { ContributionRegistry } from "@mosaix/workbench/core/contributions/contribution-registry.js";
import type {
  ResolvedLayout,
  ResolvedPlacement,
  ResolvedRegion,
} from "@mosaix/workbench/layout/engine/resolved-layout.js";

/**
 * Options de résolution de layout.
 */
export interface LayoutEngineOptions {
  /** Identifiant du layout à résoudre. Défaut : defaultLayoutId de la config. */
  layoutId?: string;
  /** Identifiant du preset à appliquer (sélectionne les régions actives). */
  presetId?: string;
}

/**
 * Moteur de résolution de layout.
 */
export class LayoutEngine {
  private readonly config: WorkbenchConfiguration;
  private readonly registry: ContributionRegistry;

  constructor(
    config: WorkbenchConfiguration,
    registry: ContributionRegistry,
  ) {
    this.config = config;
    this.registry = registry;
  }

  /**
   * Résout un layout avec les régions actives définies par un preset, ou
   * toutes les régions déclarées si aucun preset n'est spécifié.
   *
   * @param options - Options de résolution (layoutId, presetId)
   * @returns Le layout résolu, ou undefined si le layout n'existe pas.
   */
  resolveLayout(options: LayoutEngineOptions = {}): ResolvedLayout | undefined {
    const layoutId =
      options.layoutId ?? this.config.defaultLayoutId;

    if (!layoutId || layoutId.length === 0) {
      return undefined;
    }

    const layout = this.config.layouts.find((l) => l.id === layoutId);
    if (!layout) {
      return undefined;
    }

    const activeRegionIds = options.presetId
      ? this.resolvePresetRegionIds(options.presetId)
      : this.config.regions.map((r) => r.id);

    const regions = this.resolveRegions(activeRegionIds);

    return {
      layoutId: layout.id,
      presetId: options.presetId,
      regions,
    };
  }

  /**
   * Résout le layout par défaut de la configuration.
   */
  resolveDefaultLayout(): ResolvedLayout | undefined {
    return this.resolveLayout({
      layoutId: this.config.defaultLayoutId,
    });
  }

  /**
   * Résout les régions actives d'un preset.
   *
   * Lève implicitement via un retour de régions vides si le preset est
   * introuvable.
   */
  private resolvePresetRegionIds(presetId: string): string[] {
    const preset = this.config.presets.find((p) => p.id === presetId);
    if (!preset) {
      return [];
    }
    return preset.regionIds;
  }

  /**
   * Résout les placements pour une liste d'identifiants de région.
   */
  private resolveRegions(regionIds: string[]): ResolvedRegion[] {
    const resolvedRegions: ResolvedRegion[] = [];

    for (const regionId of regionIds) {
      const region = this.config.regions.find((r) => r.id === regionId);
      if (!region) {
        continue;
      }

      const placements = this.resolvePlacementsForRegion(region);

      resolvedRegions.push({
        id: region.id,
        label: region.label,
        surfaceId: region.surfaceId,
        ownedBy: region.ownedBy,
        placements,
      });
    }

    return resolvedRegions;
  }

  /**
   * Résout les placements d'une région : filtre les contributions dont un
   * placement cible le surfaceId de la région, exclut les placements
   * masqués, et trie de manière déterministe.
   */
  private resolvePlacementsForRegion(
    region: WorkbenchRegion,
  ): ResolvedPlacement[] {
    const resolved: ResolvedPlacement[] = [];

    for (const entry of this.registry.getAll()) {
      const contribution = entry.contribution;

      for (const placement of contribution.placements) {
        // Le placement doit cibler le surfaceId de cette région.
        if (placement.surfaceId !== region.surfaceId) {
          continue;
        }

        // Exclure les placements masqués.
        if (placement.hidden === true) {
          continue;
        }

        // Calculer l'ordre résolu.
        let order: number;
        let orderExplicit: boolean;

        if (typeof placement.order === "number") {
          order = placement.order;
          orderExplicit = true;
        } else if (typeof placement.priority === "number") {
          order = -(placement.priority);
          orderExplicit = true;
        } else {
          order = Number.MAX_SAFE_INTEGER;
          orderExplicit = false;
        }

        resolved.push({
          placement,
          contribution,
          order,
          orderExplicit,
          hidden: false,
        });
      }
    }

    // Tri déterministe :
    // 1. par ordre résolu (contractuel si présent, sinon MAX_SAFE_INTEGER) ;
    // 2. par identifiant de contribution comme critère secondaire stable.
    resolved.sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.contribution.id.localeCompare(b.contribution.id);
    });

    return resolved;
  }
}
