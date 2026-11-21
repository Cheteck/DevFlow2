/**
 * @mosaix/workbench — Tests du chargeur de configuration
 *
 * Couvre : configuration valide, configuration invalide (erreur explicite,
 * pas de configuration partiellement acceptée), cohérence des régions,
 * layouts et presets.
 */

import { describe, expect, it } from "vitest";
import {
  validateWorkbenchConfiguration,
  WorkbenchConfigValidationError,
} from "@mosaix/workbench/core/configuration/workbench-config-loader.js";

describe("Workbench configuration loader", () => {
  it("charge une configuration valide sans erreur", () => {
    const config = validateWorkbenchConfiguration({
      version: "1.0.0",
      branding: { platformName: "Test Platform", defaultThemeId: "test-theme" },
      regions: [
        {
          id: "main",
          label: "Main",
          surfaceId: "surface-main",
          ownedBy: "shell",
        },
      ],
      layouts: [{ id: "default", label: "Default" }],
      presets: [
        { id: "p1", label: "Preset 1", layoutId: "default", regionIds: ["main"] },
      ],
      defaultLayoutId: "default",
      uiCapabilities: { commandPalette: true },
    });

    expect(config.version).toBe("1.0.0");
    expect(config.branding.platformName).toBe("Test Platform");
    expect(config.regions).toHaveLength(1);
    expect(config.defaultLayoutId).toBe("default");
    expect(config.uiCapabilities.commandPalette).toBe(true);
  });

  it("rejet une configuration non-objet", () => {
    expect(() => validateWorkbenchConfiguration(null)).toThrow(
      WorkbenchConfigValidationError,
    );
    expect(() => validateWorkbenchConfiguration("string")).toThrow(
      WorkbenchConfigValidationError,
    );
    expect(() => validateWorkbenchConfiguration([1, 2])).toThrow(
      WorkbenchConfigValidationError,
    );
    expect(() => validateWorkbenchConfiguration(undefined)).toThrow(
      WorkbenchConfigValidationError,
    );
  });

  it("rejet une configuration sans version", () => {
    expect(() =>
      validateWorkbenchConfiguration({ branding: {} }),
    ).toThrow(WorkbenchConfigValidationError);
  });

  it("rejet une configuration avec une version vide", () => {
    expect(() =>
      validateWorkbenchConfiguration({ version: "" }),
    ).toThrow(WorkbenchConfigValidationError);
  });

  it("rejet un defaultLayoutId qui n'est pas déclaré", () => {
    expect(() =>
      validateWorkbenchConfiguration({
        version: "1.0.0",
        defaultLayoutId: "inexistant",
        layouts: [{ id: "autre", label: "Autre" }],
      }),
    ).toThrow(WorkbenchConfigValidationError);
  });

  it("rejet un preset qui référence un layout inconnu", () => {
    expect(() =>
      validateWorkbenchConfiguration({
        version: "1.0.0",
        layouts: [{ id: "l1", label: "L1" }],
        presets: [{ id: "p1", label: "P1", layoutId: "inconnu", regionIds: [] }],
      }),
    ).toThrow(WorkbenchConfigValidationError);
  });

  it("rejet un preset qui référence une région inconnue", () => {
    expect(() =>
      validateWorkbenchConfiguration({
        version: "1.0.0",
        regions: [{ id: "r1", label: "R1", surfaceId: "s1", ownedBy: "shell" }],
        layouts: [{ id: "l1", label: "L1" }],
        presets: [{ id: "p1", label: "P1", layoutId: "l1", regionIds: ["inconnu"] }],
      }),
    ).toThrow(WorkbenchConfigValidationError);
  });

  it("n'accepte pas une configuration partiellement invalide", () => {
    // Une région invalide doit faire échouer toute la configuration.
    expect(() =>
      validateWorkbenchConfiguration({
        version: "1.0.0",
        regions: [{ id: "", label: "R", surfaceId: "s", ownedBy: "shell" }],
      }),
    ).toThrow(WorkbenchConfigValidationError);
  });

  it("utilise le premier layout comme defaultLayoutId par défaut", () => {
    const config = validateWorkbenchConfiguration({
      version: "1.0.0",
      layouts: [{ id: "l1", label: "L1" }],
    });
    expect(config.defaultLayoutId).toBe("l1");
  });

  it("accepte une configuration minimale sans régions ni layouts", () => {
    const config = validateWorkbenchConfiguration({
      version: "1.0.0",
    });
    expect(config.regions).toEqual([]);
    expect(config.layouts).toEqual([]);
    expect(config.defaultLayoutId).toBe("");
  });
});
