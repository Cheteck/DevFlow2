/**
 * @mosaix/workbench — Runtime Adapter Port
 *
 * Interfaces que le cœur du Workbench nécessite pour consommer le
 * Runtime MosaiX, sans dépendre directement de @mosaix/core.
 *
 * Le cœur du Workbench définit ces ports. L'implémentation concrète qui
 * consomme @mosaix/core (RuntimeKernel, BacOrchestrator,
 * PermissionRegistry, …) appartient à l'adaptateur Runtime, fourni par le
 * projet consommateur.
 *
 * Dépendance autorisée : @mosaix/contracts (contrats transversaux uniquement).
 * Aucune dépendance vers @mosaix/core, src/shell/ ou apps/.
 */

import type { BacDescriptor } from "@mosaix/contracts";
import type { WorkspaceContext } from "@mosaix/workbench/context/workspace-context.js";

/**
 * Port de consommation du Runtime MosaiX.
 *
 * Le Workbench utilise ce port pour obtenir :
 * - les descripteurs BAC disponibles (navigation et rendu) ;
 * - les permissions de l'utilisateur actuel (filtrage d'affichage) ;
 * - le contexte de travail actuel ;
 * - l'état d'authentification.
 *
 * Chaque méthode retourne des données en lecture seule. Le Workbench ne
 * modifie jamais l'état du Runtime via ce port.
 */
export interface RuntimeAdapterPort {
  /**
   * Liste des descripteurs BAC disponibles pour la navigation et le rendu.
   * Chaque descripteur représente un BAC découvert et validé par le Runtime.
   */
  getBacDescriptors(): ReadonlyArray<BacDescriptor>;

  /**
   * Permissions de l'utilisateur actuel.
   * Utilisées par le Workbench pour le filtrage d'affichage uniquement.
   * Ce n'est PAS une protection d'accès : chaque BAC et chaque API applique
   * ses propres contrôles d'autorisation.
   */
  getUserPermissions(): string[];

  /**
   * Contexte de travail actuel (organisation, projet, entité active…).
   * Peut être null si aucun contexte n'est actif.
   */
  getWorkspaceContext(): WorkspaceContext | null;

  /**
   * Indique si l'utilisateur est authentifié.
   * Ne doit jamais être déduit d'une liste de rôles.
   */
  isAuthenticated(): boolean;
}

/**
 * Résultat de résolution des BAC pour la navigation.
 * Projection d'affichage des descripteurs BAC.
 */
export interface BacNavigationEntry {
  id: string;
  name: string;
  route: string;
  icon?: string;
  requiredPermissions?: string[];
  isEnabled: boolean;
}
