/**
 * @mosaix/contracts — Admin Page Contribution Contract
 * Contrat standardisé permettant à tout Bounded Application Contract (BAC)
 * de déclarer et fournir des pages et sous-systèmes d'administration consommés
 * dynamiquement par Imperia ou le Shell MosaiX.
 */

export type AdminPageCategory =
  | "operations"
  | "identity"
  | "moderation"
  | "infrastructure"
  | "content"
  | "commerce"
  | "collaboration"
  | "custom";

export interface AdminBadge {
  text: string;
  variant?: "primary" | "success" | "warning" | "danger" | "purple" | "neutral";
}

export interface AdminMetricSummary {
  id: string;
  label: string;
  value: string | number;
  change?: string;
  status?: "nominal" | "warning" | "critical" | "info";
  icon?: string;
}

export interface AdminRenderContext {
  activeTab?: string;
  userRoles?: string[];
  themeMode?: string;
  tenantId?: string;
}

export interface AdminPageContribution {
  /** Identifiant unique de la page d'administration (ex: "commerce-admin-orders", "solara-moderation") */
  id: string;
  /** Identifiant du BAC propriétaire (ex: "@apps/commerce", "spaces", "@apps/citadelle") */
  bacId: string;
  /** Titre affiché dans les onglets et en-têtes (ex: "Commandes & Inventaire") */
  title: string;
  /** Description du domaine administratif */
  description?: string;
  /** Nom de l'icône Material Symbol (ex: "storefront", "group", "folder_open", "tune") */
  icon: string;
  /** Route virtuelle ou canonique de l'administration */
  route: string;
  /** Catégorie fonctionnelle pour l'organisation */
  category?: AdminPageCategory;
  /** Ordre d'affichage dans la navigation (croissant) */
  order?: number;
  /** Permission ou rôle requis pour accéder à cette console */
  permission?: string;
  /** Liste étendue des permissions nécessaires */
  requiredPermissions?: string[];
  /** Badge visuel d'état ou de comptage */
  badge?: AdminBadge;
  /** Métriques résumées injectables dans le dashboard global */
  metrics?: AdminMetricSummary[];
  /** Fonction de rendu HTML exécutée lors de l'affichage de l'onglet */
  render: (context?: AdminRenderContext) => string;
}
