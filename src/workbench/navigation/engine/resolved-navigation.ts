/**
 * @mosaix/workbench — Resolved Navigation Types
 *
 * Modèles de sortie de la résolution de navigation.
 *
 * Une résolution transforme les contributions de kind "navigation" et les
 * déclarations de navigation en une liste ordonnée d'items de navigation,
 * filtrés selon les permissions de l'utilisateur et le contexte de travail.
 *
 * Le filtrage par permission est purement visuel (affichage). Chaque BAC et
 * chaque API applique ses propres contrôles d'autorisation.
 *
 * Indépendant du DOM et du Rendering Adapter.
 */

import type { NavigationItem } from "@mosaix/contracts";

/**
 * Item de navigation résolu, prêt à être affiché par le Rendering Adapter.
 */
export interface ResolvedNavigationItem {
  /** Identifiant unique de l'item. */
  id: string;
  /** Libellé affiché. */
  label: string;
  /** Icône (Material Symbol, emoji, ou asset). */
  icon?: string;
  /** Route ou cible de navigation. */
  target: string;
  /** Ordre de présentation (plus petit = affiché en premier). */
  order: number;
  /** Permission requise pour voir l'item (filtrage d'affichage uniquement). */
  requiresPermission?: string;
  /** L'item est-il actuellement visible ? */
  visible: boolean;
  /** Source de l'item : contribution BAC ou configuration directe. */
  source: "contribution" | "configuration";
  /** Identifiant de la contribution d'origine (si source = contribution). */
  contributionId?: string;
}
