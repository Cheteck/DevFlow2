/**
 * @mosaix/workbench — Workbench Configuration Loader
 *
 * Charge et valide la configuration du Workbench depuis une source
 * déclarative.
 *
 * Fail-fast explicite : aucune configuration partiellement acceptée.
 *
 * Le cœur du Workbench ne dépend d'aucune implémentation concrète de
 * chargement : tout chargeur implémentant WorkbenchConfigLoader peut être
 * utilisé par le projet consommateur.
 */

import type { WorkbenchConfiguration } from "@mosaix/workbench/core/contracts/workbench-configuration.js";
import { MINIMAL_WORKBENCH_CONFIG } from "@mosaix/workbench/core/contracts/workbench-configuration.js";

/**
 * Port : charge la configuration du Workbench pour un projet donné.
 */
export interface WorkbenchConfigLoader {
  load(): Promise<WorkbenchConfigResult>;
}

/** Résultat de chargement avec métadonnées. */
export interface WorkbenchConfigResult {
  config: WorkbenchConfiguration;
  source: string;
  loadedAt: number;
}

/** Erreur de validation de la configuration Workbench. */
export class WorkbenchConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkbenchConfigValidationError";
  }
}

/**
 * Valide une configuration Workbench brute.
 * Lève WorkbenchConfigValidationError en cas d'incohérence.
 */
export function validateWorkbenchConfiguration(
  raw: unknown,
): WorkbenchConfiguration {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new WorkbenchConfigValidationError(
      "Workbench configuration must be a non-null object.",
    );
  }

  const c = raw as Record<string, unknown>;

  const version =
    typeof c.version === "string" && c.version.length > 0
      ? c.version
      : (() => {
          throw new WorkbenchConfigValidationError(
            'Workbench configuration "version" is required (non-empty string).',
          );
        })();

  const branding = normalizeBranding(c.branding);
  const regions = normalizeRegions(c.regions);
  const layouts = normalizeLayouts(c.layouts);
  const presets = normalizePresets(c.presets, regions, layouts);
  const defaultLayoutId = resolveDefaultLayoutId(c.defaultLayoutId, layouts);
  const defaultPresetId = normalizeDefaultPresetId(
    c.defaultPresetId,
    presets,
  );
  const uiCapabilities = normalizeUICapabilities(c.uiCapabilities);

  // Règle de cohérence : si un defaultLayoutId est défini, il doit exister.
  // Une chaîne vide est autorisée quand aucun layout n'est déclaré.
  if (defaultLayoutId.length > 0 && !layouts.some((l) => l.id === defaultLayoutId)) {
    throw new WorkbenchConfigValidationError(
      `Workbench configuration: defaultLayoutId "${defaultLayoutId}" is not declared in layouts.`,
    );
  }

  // Règle de cohérence : chaque preset doit référencer un layout et des
  // régions déclarés.
  for (const preset of presets) {
    if (!layouts.some((l) => l.id === preset.layoutId)) {
      throw new WorkbenchConfigValidationError(
        `Workbench configuration: preset "${preset.id}" references unknown layout "${preset.layoutId}".`,
      );
    }
    for (const regionId of preset.regionIds) {
      if (!regions.some((r) => r.id === regionId)) {
        throw new WorkbenchConfigValidationError(
          `Workbench configuration: preset "${preset.id}" references unknown region "${regionId}".`,
        );
      }
    }
  }

  return {
    version,
    branding,
    regions,
    layouts,
    presets,
    defaultLayoutId,
    defaultPresetId,
    uiCapabilities,
  };
}

function normalizeBranding(raw: unknown): WorkbenchConfiguration["branding"] {
  const b = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    platformName:
      typeof b.platformName === "string" && b.platformName.length > 0
        ? b.platformName
        : "MosaiX Platform",
    defaultThemeId:
      typeof b.defaultThemeId === "string" && b.defaultThemeId.length > 0
        ? b.defaultThemeId
        : "mosaix-default",
  };
}

function normalizeRegions(
  raw: unknown,
): WorkbenchConfiguration["regions"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r, index) => {
    if (!r || typeof r !== "object") {
      throw new WorkbenchConfigValidationError(
        `Workbench configuration: region at index ${index} must be an object.`,
      );
    }
    const region = r as Record<string, unknown>;
    if (typeof region.id !== "string" || region.id.length === 0) {
      throw new WorkbenchConfigValidationError(
        `Workbench configuration: region at index ${index} requires a non-empty "id".`,
      );
    }
    if (typeof region.label !== "string" || region.label.length === 0) {
      throw new WorkbenchConfigValidationError(
        `Workbench configuration: region "${region.id}" requires a non-empty "label".`,
      );
    }
    if (typeof region.surfaceId !== "string" || region.surfaceId.length === 0) {
      throw new WorkbenchConfigValidationError(
        `Workbench configuration: region "${region.id}" requires a non-empty "surfaceId".`,
      );
    }
    if (region.ownedBy !== "shell" && region.ownedBy !== "application") {
      throw new WorkbenchConfigValidationError(
        `Workbench configuration: region "${region.id}" ownedBy must be "shell" or "application".`,
      );
    }
    return {
      id: region.id,
      label: region.label,
      surfaceId: region.surfaceId,
      ownedBy: region.ownedBy,
    };
  });
}

function normalizeLayouts(
  raw: unknown,
): WorkbenchConfiguration["layouts"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((l, index) => {
    if (!l || typeof l !== "object") {
      throw new WorkbenchConfigValidationError(
        `Workbench configuration: layout at index ${index} must be an object.`,
      );
    }
    const layout = l as Record<string, unknown>;
    if (typeof layout.id !== "string" || layout.id.length === 0) {
      throw new WorkbenchConfigValidationError(
        `Workbench configuration: layout at index ${index} requires a non-empty "id".`,
      );
    }
    if (typeof layout.label !== "string" || layout.label.length === 0) {
      throw new WorkbenchConfigValidationError(
        `Workbench configuration: layout "${layout.id}" requires a non-empty "label".`,
      );
    }
    return { id: layout.id, label: layout.label };
  });
}

function normalizePresets(
  raw: unknown,
  regions: WorkbenchConfiguration["regions"],
  layouts: WorkbenchConfiguration["layouts"],
): WorkbenchConfiguration["presets"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p, index) => {
    if (!p || typeof p !== "object") {
      throw new WorkbenchConfigValidationError(
        `Workbench configuration: preset at index ${index} must be an object.`,
      );
    }
    const preset = p as Record<string, unknown>;
    if (typeof preset.id !== "string" || preset.id.length === 0) {
      throw new WorkbenchConfigValidationError(
        `Workbench configuration: preset at index ${index} requires a non-empty "id".`,
      );
    }
    if (typeof preset.label !== "string" || preset.label.length === 0) {
      throw new WorkbenchConfigValidationError(
        `Workbench configuration: preset "${preset.id}" requires a non-empty "label".`,
      );
    }
    if (typeof preset.layoutId !== "string" || preset.layoutId.length === 0) {
      throw new WorkbenchConfigValidationError(
        `Workbench configuration: preset "${preset.id}" requires a non-empty "layoutId".`,
      );
    }
    if (!Array.isArray(preset.regionIds)) {
      throw new WorkbenchConfigValidationError(
        `Workbench configuration: preset "${preset.id}" requires a "regionIds" array.`,
      );
    }
    return {
      id: preset.id,
      label: preset.label,
      layoutId: preset.layoutId,
      regionIds: preset.regionIds.filter(
        (id): id is string => typeof id === "string",
      ),
    };
  });
}

function resolveDefaultLayoutId(
  raw: unknown,
  layouts: WorkbenchConfiguration["layouts"],
): string {
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (layouts.length > 0) return layouts[0].id;
  return "";
}

function normalizeDefaultPresetId(
  raw: unknown,
  presets: WorkbenchConfiguration["presets"],
): string | undefined {
  if (typeof raw === "string" && raw.length > 0) return raw;
  return undefined;
}

function normalizeUICapabilities(
  raw: unknown,
): WorkbenchConfiguration["uiCapabilities"] {
  const u = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    commandPalette: u.commandPalette !== undefined ? Boolean(u.commandPalette) : false,
    liveEditor: u.liveEditor !== undefined ? Boolean(u.liveEditor) : false,
    notifications: u.notifications !== undefined ? Boolean(u.notifications) : false,
    mobileDrawer: u.mobileDrawer !== undefined ? Boolean(u.mobileDrawer) : false,
    presence: u.presence !== undefined ? Boolean(u.presence) : false,
  };
}

/**
 * Chargeur par défaut : retourne la configuration minimale.
 * Aucun fichier de configuration n'est requis au démarrage.
 */
export class DefaultWorkbenchConfigLoader implements WorkbenchConfigLoader {
  async load(): Promise<WorkbenchConfigResult> {
    return {
      config: { ...MINIMAL_WORKBENCH_CONFIG },
      source: "default",
      loadedAt: Date.now(),
    };
  }
}
