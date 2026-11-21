/**
 * @mosaix/workbench — Contribution Resolver
 *
 * Résolution déterministe des contributions enregistrées dans le registre.
 *
 * Règles de résolution stable (Reserve B) :
 * 1. Respecter les règles d'ordre définies par les contrats (order,
 *    priority…) ;
 * 2. Utiliser un critère secondaire stable en cas d'égalité (identifiant) ;
 * 3. Ne jamais remplacer l'ordre métier par un tri alphabétique arbitraire.
 *
 * Le tri alphabétique de l'identifiant n'est qu'un critère de dénouement
 * lorsque l'ordre n'est pas contractuellement défini.
 *
 * Réutilise PlacementContract de @mosaix/contracts pour l'ordre des placements.
 */

import type {
  ContributionContract,
  ExperienceKind,
  PlacementContract,
} from "@mosaix/contracts";
import { ContributionRegistry } from "@mosaix/workbench/core/contributions/contribution-registry.js";

/**
 * Résultat de résolution d'une contribution : la contribution et son
 * ordre de présentation résolu.
 */
export interface ResolvedContribution {
  contribution: ContributionContract;
  /** Ordre de présentation résolu (plus petit = affiché en premier). */
  order: number;
  /** Indique si l'ordre provient d'un champ contractuel explicite. */
  orderExplicit: boolean;
}

/**
 * Options de résolution.
 */
export interface ContributionResolverOptions {
  /** Filtrer par kind. */
  kind?: ExperienceKind;
  /**
   * Filtrer par permissions requises.
   * Une contribution est incluse si elle déclare au moins l'une des
   * permissions requises par l'appelant. C'est un filtrage d'affichage,
   * jamais une protection d'accès.
   */
  requiredPermissions?: string[];
  /** Sens du tri : "asc" (défaut) ou "desc". */
  direction?: "asc" | "desc";
}

/**
 * Sélectionne le placement principal d'une contribution.
 *
 * Prend le placement avec l'ordre le plus petit, ou la première déclaration
 * si aucun ordre n'est défini.
 */
function pickPrimaryPlacement(
  placements: PlacementContract[],
): PlacementContract | undefined {
  if (placements.length === 0) return undefined;
  const ordered = [...placements].sort((a, b) => {
    const aOrder = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
    const bOrder = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
  return ordered[0];
}

/**
 * Calcule l'ordre de présentation résolu pour une contribution.
 *
 * - Si un placement définit un order contractuel, il est respecté.
 * - Sinon, si un placement définit une priority, elle est inversée (plus
 *   haute priorité = affiché en premier).
 * - Sinon, l'ordre est MAX_SAFE_INTEGER (non ordonné : après les ordonnés).
 */
function computeResolvedOrder(
  contribution: ContributionContract,
): { order: number; orderExplicit: boolean } {
  const placement = pickPrimaryPlacement(contribution.placements);

  if (placement && typeof placement.order === "number") {
    return { order: placement.order, orderExplicit: true };
  }

  if (placement && typeof placement.priority === "number") {
    // priority : plus haute valeur = affiché en premier → on inverse.
    return { order: -(placement.priority), orderExplicit: true };
  }

  return { order: Number.MAX_SAFE_INTEGER, orderExplicit: false };
}

/**
 * Résout les contributions enregistrées de manière déterministe.
 *
 * @param registry - Registre de contributions.
 * @param options - Options de filtrage et de tri.
 * @returns Liste des contributions résolues, triée de manière déterministe.
 *
 * La résolution est déterministe : à configuration et contributions
 * identiques, le résultat est identique, indépendamment de l'ordre d'arrivée
 * lorsque cet ordre n'est pas contractuellement significatif.
 */
export function resolveContributions(
  registry: ContributionRegistry,
  options: ContributionResolverOptions = {},
): ResolvedContribution[] {
  const { kind, requiredPermissions, direction = "asc" } = options;

  const entries = kind
    ? registry.getByKind(kind)
    : registry.getAll();

  const resolved: ResolvedContribution[] = entries
    .filter((entry) => {
      if (!requiredPermissions || requiredPermissions.length === 0) {
        return true;
      }
      const required =
        entry.contribution.policies?.requiredPermissions;
      if (!required || required.length === 0) {
        return true;
      }
      // Filtrage d'affichage : inclusion si au moins une permission requise
      // par l'appelant est déclarée par la contribution.
      return requiredPermissions.some((p) => required.includes(p));
    })
    .map((entry) => {
      const { order, orderExplicit } = computeResolvedOrder(
        entry.contribution,
      );
      return {
        contribution: entry.contribution,
        order,
        orderExplicit,
      };
    });

  // Tri déterministe :
  // 1. par ordre résolu (contractuel si présent, sinon MAX_SAFE_INTEGER) ;
  // 2. par identifiant comme critère secondaire stable.
  resolved.sort((a, b) => {
    if (a.order !== b.order) {
      return direction === "asc" ? a.order - b.order : b.order - a.order;
    }
    return a.contribution.id.localeCompare(b.contribution.id);
  });

  return resolved;
}
