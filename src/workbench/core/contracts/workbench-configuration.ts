/**
 * @mosaix/workbench — Workbench Configuration Contracts
 *
 * Déclaration de la configuration du Workbench MosaiX pour un projet
 * consommateur.
 *
 * Chaque projet configure le Workbench uniquement par ces contrats, sans
 * modifier le code source du Workbench.
 *
 * Réutilise les contrats transversaux de @mosaix/contracts :
 * - SurfaceContract (définition des régions de composition et de leurs slots)
 * - SlotContract (points d'extension dans une surface)
 * - PlacementContract (positionnement des blocs)
 *
 * Ce module définit uniquement ce qui manque à l'existant : la configuration
 * projet du Workbench. Aucun contrat existant n'est dupliqué.
 */

import type { SurfaceContract } from "@mosaix/contracts";

/**
 * Identité visuelle du Workbench pour un projet consommateur.
 */
export interface WorkbenchBranding {
  /** Nom de la plateforme affiché dans l'en-tête. */
  platformName: string;
  /** Identifiant du thème par défaut (résolu dans le catalogue thèmes MosaiX). */
  defaultThemeId: string;
}

/**
 * Référence à une région structurelle déclarée par le projet.
 *
 * Ne redéfinit pas les propriétés de SurfaceContract : elle référence
 * une surface existante par son identifiant. SurfaceContract reste
 * l'autorité des propriétés de la région et de ses slots.
 */
export interface WorkbenchRegion {
  /** Identifiant unique de la région dans ce projet. */
  id: string;
  /** Libellé d'affichage de la région. */
  label: string;
  /** Référence à une SurfaceContract définissant la région et ses slots. */
  surfaceId: string;
  /**
   * Propriétaire de la surface.
   * "shell" = cadre global ; "application" = contenu fonctionnel.
   */
  ownedBy: "shell" | "application";
}

/**
 * Référence à un LayoutContract connu du projet.
 */
export interface WorkbenchLayoutRef {
  /** Identifiant unique du layout. */
  id: string;
  /** Libellé d'affichage du layout. */
  label: string;
}

/**
 * Présélection de composition (layout + régions actives).
 */
export interface WorkbenchPreset {
  /** Identifiant unique du preset. */
  id: string;
  /** Libellé d'affichage du preset. */
  label: string;
  /** Layout appliqué par ce preset. */
  layoutId: string;
  /** Identifiants des régions actives dans ce preset. */
  regionIds: string[];
}

/**
 * Capacités UI offertes par le Workbench dans ce projet.
 */
export interface WorkbenchUICapabilities {
  /** Commande globale (⌘K). */
  commandPalette?: boolean;
  /** Éditeur de composition live. */
  liveEditor?: boolean;
  /** Notifications (toast, badge). */
  notifications?: boolean;
  /** Drawer mobile. */
  mobileDrawer?: boolean;
  /** Présence (en ligne, occupé, absent…). */
  presence?: boolean;
}

/**
 * Configuration complète du Workbench pour un projet consommateur.
 *
 * Déclarative, validable, versionnable. Aucun profil, rôle ou BAC codé en dur.
 */
export interface WorkbenchConfiguration {
  version: string;
  branding: WorkbenchBranding;
  regions: WorkbenchRegion[];
  layouts: WorkbenchLayoutRef[];
  presets: WorkbenchPreset[];
  defaultLayoutId: string;
  defaultPresetId?: string;
  uiCapabilities: WorkbenchUICapabilities;
}

/** Configuration minimale valide (projet vierge). */
export const MINIMAL_WORKBENCH_CONFIG: WorkbenchConfiguration = {
  version: "1.0.0",
  branding: {
    platformName: "MosaiX Platform",
    defaultThemeId: "mosaix-default",
  },
  regions: [],
  layouts: [],
  presets: [],
  defaultLayoutId: "",
  uiCapabilities: {
    commandPalette: false,
    liveEditor: false,
    notifications: false,
    mobileDrawer: false,
    presence: false,
  },
};
