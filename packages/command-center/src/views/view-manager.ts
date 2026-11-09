/**
 * @mosaix/command-center — ViewManager (Lot 01 - Refonte d'interface).
 *
 * Gère la vue active du Developer Console et la navigation entre les vues.
 * Chaque vue consomme le snapshot existant du Supervisor sans créer de nouvelles
 * sources de données.
 *
 * Architecture orientée vues (recommandation ChatGPT-web) :
 * - Dashboard : état global du système
 * - Process Explorer : gestion individuelle des processus
 * - Log Explorer : exploration des logs avec recherche
 * - Diagnostics Center : erreurs et diagnostics
 * - Environment : état du watcher et de la configuration
 * - Session History : chronologie des événements
 */
import type { CommandCenterSnapshot, ServiceName } from "../supervisor-types.js";

export type ViewName = "dashboard" | "processes" | "logs" | "diagnostics" | "environment" | "sessions";

export interface ViewContext {
  /** Vue active actuellement affichée. */
  activeView: ViewName;
  /** ID du processus sélectionné (pour le Process Explorer). */
  selectedService: ServiceName | null;
  /** Snapshot complet du système pour lecture. */
  snapshot: CommandCenterSnapshot;
}

export interface ViewConfig {
  id: ViewName;
  label: string;
  description: string;
  icon: string;
}

export const VIEW_CONFIGS: Record<ViewName, ViewConfig> = {
  dashboard: {
    id: "dashboard",
    label: "Dashboard",
    description: "État global du système",
    icon: "📊",
  },
  processes: {
    id: "processes",
    label: "Process Explorer",
    description: "Gestion des processus supervisés",
    icon: "⚙️",
  },
  logs: {
    id: "logs",
    label: "Log Explorer",
    description: "Exploration des logs API/MCP/Supervisor",
    icon: "📋",
  },
  diagnostics: {
    id: "diagnostics",
    label: "Diagnostics Center",
    description: "Diagnostics et erreurs du système",
    icon: "🔍",
  },
  environment: {
    id: "environment",
    label: "Environment",
    description: "Configuration et watcher d'environnement",
    icon: "🔧",
  },
  sessions: {
    id: "sessions",
    label: "Session History",
    description: "Chronologie des événements et redémarrages",
    icon: "📜",
  },
};

/**
 * Gère la vue active et la navigation entre les vues du Developer Console.
 */
export class ViewManager {
  private activeView: ViewName = "dashboard";
  private selectedService: ServiceName | null = null;
  private snapshot: CommandCenterSnapshot | null = null;

  constructor() {
    // Vue par défaut : dashboard
  }

  /** Retourne la vue active. */
  getActiveView(): ViewName {
    return this.activeView;
  }

  /** Définit la vue active. */
  setActiveView(view: ViewName): void {
    this.activeView = view;
  }

  /** Retourne le service sélectionné. */
  getSelectedService(): ServiceName | null {
    return this.selectedService;
  }

  /** Sélectionne un service pour le Process Explorer. */
  selectService(service: ServiceName | null): void {
    this.selectedService = service;
    if (service !== null) {
      this.activeView = "processes";
    }
  }

  /** Met à jour le snapshot courant. */
  updateSnapshot(snapshot: CommandCenterSnapshot): void {
    this.snapshot = snapshot;
  }

  /** Retourne le snapshot actuel. */
  getSnapshot(): CommandCenterSnapshot | null {
    return this.snapshot;
  }

  /** Vérifie si une vue est active. */
  isActive(view: ViewName): boolean {
    return this.activeView === view;
  }

  /** Retourne la configuration d'une vue. */
  getViewConfig(view: ViewName): ViewConfig {
    return VIEW_CONFIGS[view];
  }

  /** Retourne toutes les configurations de vues. */
  getAllViewConfigs(): ViewConfig[] {
    return Object.values(VIEW_CONFIGS);
  }
}

// Instance singleton du gestionnaire de vues.
export const viewManager = new ViewManager();