/**
 * @mosaix/workbench — Navigation Engine
 *
 * Moteur de résolution de navigation du Workbench.
 *
 * Transforme les contributions de kind "navigation" et les descripteurs BAC
 * du Runtime en une liste ordonnée d'items de navigation, filtrés selon les
 * permissions de l'utilisateur et le contexte de travail.
 *
 * Le filtrage par permission est purement visuel (affichage). Chaque BAC et
 * chaque API applique ses propres contrôles d'autorisation.
 *
 * Dépendances :
 * - @mosaix/contracts (NavigationContract, NavigationItem) — contrats transversaux
 * - ContributionRegistry (interne)
 * - RuntimeAdapterPort (port défini par le Workbench, implémenté par l'adaptateur)
 *
 * Aucune dépendance vers @mosaix/core, src/shell/ ou apps/.
 */

import type {
  NavigationContract,
  NavigationItem,
} from "@mosaix/contracts";
import type { ResolvedNavigationItem } from "@mosaix/workbench/navigation/engine/resolved-navigation.js";
import type { RuntimeAdapterPort } from "@mosaix/workbench/adapters/runtime/runtime-port.js";
import type { WorkspaceContext } from "@mosaix/workbench/context/workspace-context.js";
import { ContributionRegistry } from "@mosaix/workbench/core/contributions/contribution-registry.js";
import { contentValidators } from "@mosaix/workbench/core/contributions/contribution-validator.js";

/**
 * Options de résolution de navigation.
 */
export interface NavigationEngineOptions {
  /** Filtrer les items par contexte de travail. Défaut : aucun filtrage. */
  workspaceContext?: WorkspaceContext | null;
  /** Inclure les BAC du Runtime comme items de navigation. Défaut : true. */
  includeBacDescriptors?: boolean;
}

/**
 * Moteur de résolution de navigation.
 */
export class NavigationEngine {
  private readonly registry: ContributionRegistry;
  private readonly runtimePort?: RuntimeAdapterPort;

  constructor(
    registry: ContributionRegistry,
    runtimePort?: RuntimeAdapterPort,
  ) {
    this.registry = registry;
    this.runtimePort = runtimePort;
  }

  /**
   * Résout la navigation complète : items de contributions + items BAC du
   * Runtime, filtrés et triés de manière déterministe.
   *
   * @param options - Options de filtrage (contexte, inclusion BAC)
   * @returns Liste des items de navigation résolus, triée par order puis id.
   */
  resolveNavigation(options: NavigationEngineOptions = {}): ResolvedNavigationItem[] {
    const { workspaceContext, includeBacDescriptors = true } = options;

    const items: ResolvedNavigationItem[] = [];

    // 1. Items provenant des contributions de kind "navigation".
    const navContributions = this.registry.getByKind("navigation");
    for (const entry of navContributions) {
      const content = entry.contribution.content;
      if (!content || typeof content !== "object" || Array.isArray(content)) {
        continue;
      }

      const navContent = content as unknown as NavigationContract;
      const rawItems = Array.isArray(navContent.items) ? navContent.items : [];

      for (const rawItem of rawItems) {
        const item = this.resolveNavigationItem(
          rawItem,
          "contribution",
          entry.contribution.id,
          workspaceContext,
        );
        if (item) {
          items.push(item);
        }
      }
    }

    // 2. Items provenant des descripteurs BAC du Runtime (si activé).
    if (includeBacDescriptors && this.runtimePort) {
      const bacDescriptors = this.runtimePort.getBacDescriptors();
      const userPermissions = this.runtimePort.getUserPermissions();

      for (const bac of bacDescriptors) {
        if (!bac.isEnabled) continue;

        // Filtrage par permissions requises du BAC (filtrage d'affichage).
        const requiredPerms = bac.requiredPermissions;
        if (
          requiredPerms &&
          requiredPerms.length > 0 &&
          !userPermissions.some((p) => requiredPerms.includes(p))
        ) {
          continue;
        }

        items.push({
          id: bac.id,
          label: bac.name,
          icon: bac.icon,
          target: bac.routePrefix,
          order: 100, // ordre par défaut pour les BAC du Runtime
          requiresPermission: undefined,
          visible: true,
          source: "configuration",
          contributionId: undefined,
        });
      }
    }

    // Tri déterministe : par order, puis par identifiant (critère secondaire stable).
    items.sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.id.localeCompare(b.id);
    });

    return items;
  }

  /**
   * Résout un seul item de navigation depuis une entrée brute.
   *
   * Applique le filtrage par permission et par contexte de travail.
   * Retourne null si l'item doit être masqué.
   */
  private resolveNavigationItem(
    rawItem: NavigationItem,
    source: ResolvedNavigationItem["source"],
    contributionId: string | undefined,
    workspaceContext: WorkspaceContext | null | undefined,
  ): ResolvedNavigationItem | null {
    // Filtrage par permission requise (filtrage d'affichage uniquement).
    // Le Workbench ne connaît pas les permissions de l'utilisateur ici ;
    // le filtrage effectif est appliqué par l'appelant via resolveNavigation
    // avec le runtimePort. Ce filtrage local est une précaution supplémentaire.
    const hasPermission = this.checkPermission(rawItem.requiresPermission);
    if (!hasPermission) {
      return null;
    }

    // Filtrage par contexte de travail (allowedTenants dans les policies).
    // Le contexte est fourni par l'autorité compétente, jamais déduit ici.
    if (workspaceContext?.organizationId) {
      // Si la contribution déclare des tenants autorisés et que l'organisation
      // active n'en fait pas partie, masquer l'item.
      // Cette vérification se fait au niveau de la contribution, pas de l'item
      // individuel. Pour simplifier, on vérifie ici si l'item a une
      // contrainte de contexte implicite (routePattern).
      if (rawItem.target && this.isRouteBlockedByContext(rawItem.target, workspaceContext)) {
        return null;
      }
    }

    return {
      id: rawItem.id,
      label: rawItem.label,
      icon: rawItem.icon,
      target: rawItem.target,
      order: typeof rawItem.order === "number" ? rawItem.order : 100,
      requiresPermission: rawItem.requiresPermission,
      visible: true,
      source,
      contributionId,
    };
  }

  /**
   * Vérifie si une permission requise est satisfaite.
   * Sans RuntimeAdapterPort, aucune permission n'est considérée détenue
   * (fail-safe : les items avec requiresPermission sont masqués).
   */
  private checkPermission(requiresPermission?: string): boolean {
    if (!requiresPermission) return true;
    if (!this.runtimePort) return false; // fail-safe
    const userPermissions = this.runtimePort.getUserPermissions();
    return userPermissions.includes(requiresPermission);
  }

  /**
   * Vérifie si une route est bloquée par le contexte de travail.
   * Règle conservatrice : sans règle explicite, la route n'est pas bloquée.
   */
  private isRouteBlockedByContext(
    route: string,
    _workspaceContext: WorkspaceContext,
  ): boolean {
    // Aucune règle de blocage par contexte n'est définie par défaut.
    // Le contexte de travail influence la navigation via les politiques
    // de contribution (allowedTenants, routePattern), évaluées au niveau
    // de la contribution, pas de l'item individuel.
    return false;
  }
}

/**
 * Crée une instance de NavigationEngine avec les dépendances par défaut.
 * Utilisée quand aucun RuntimeAdapterPort n'est encore disponible
 * (ex: tests, projets sans intégration Runtime).
 */
export function createNavigationEngine(
  registry?: ContributionRegistry,
): NavigationEngine {
  return new NavigationEngine(
    registry ?? new ContributionRegistry(contentValidators),
  );
}
