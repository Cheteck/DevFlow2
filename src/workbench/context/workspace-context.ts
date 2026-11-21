/**
 * @mosaix/workbench — Workspace Context Contract
 *
 * Décrit où et dans quel contexte de travail se trouve l'utilisateur.
 *
 * Distinct de CompositionContext (@mosaix/contracts), qui fournit les
 * informations techniques nécessaires à la résolution et à la composition
 * de l'interface.
 *
 * Règles impératives :
 * - WorkspaceContext décrit l'environnement de travail actif (organisation,
 *   projet, entité active, contexte personnel ou organisationnel).
 * - L'identité, les memberships et les autorisations restent sous l'autorité
 *   de leurs composants propriétaires (authentification, PermissionRegistry,
 *   AuthorizationEngine).
 * - Le Workbench ne déduit jamais lui-même des permissions à partir du
 *   contexte organisationnel.
 * - Les capacités autorisées sont une donnée fournie par l'autorité
 *   compétente, jamais une décision prise par le Workbench.
 * - Le modèle Space d'IJideals n'est pas imposé : ce contrat reste générique
 *   et indépendant de tout projet consommateur.
 */

export interface WorkspaceContext {
  /** Identifiant de l'organisation active (optionnel, selon le projet). */
  organizationId?: string;
  /** Identifiant du projet actif (optionnel, selon le projet). */
  projectId?: string;
  /** Identifiant de l'entité ou ressource active (optionnel). */
  activeEntityId?: string;
  /** Type de l'entité active (optionnel). */
  activeEntityType?: string;
  /**
   * Capacités autorisées pour ce contexte.
   * Donnée fournie par l'autorité compétente, jamais déduite par le Workbench.
   */
  authorizedCapabilities?: string[];
  /** Locale de l'utilisateur. */
  locale?: string;
}

/** Aucun contexte de travail actif (contexte personnel par défaut). */
export const NO_ACTIVE_WORKSPACE: WorkspaceContext = {};
