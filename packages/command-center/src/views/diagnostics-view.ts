/**
 * @mosaix/command-center — Diagnostics Center View (Lot 01 - Refonte d'interface).
 *
 * Affiche les diagnostics du système avec leur niveau de sévérité.
 * Consomme le snapshot existant (snapshot.diagnostics).
 */
import type { CommandCenterSnapshot } from "../supervisor-types.js";
import { formatClock } from "../format.js";
import { ANSI, paint } from "../theme.js";
import { panel } from "../cockpit.js";
import { ViewRenderer } from "./view-types.js";

export function renderDiagnosticsPanel(
  snapshot: CommandCenterSnapshot,
  width: number,
  enabled: boolean
): string[] {
  const body: string[] = [];

  body.push(`  ${paint("DIAGNOSTICS CENTER", ANSI.bold, enabled)}`);
  body.push("");

  const errors = snapshot.diagnostics.filter((d) => d.level === "error");
  const warnings = snapshot.diagnostics.filter((d) => d.level === "warn");
  const infos = snapshot.diagnostics.filter((d) => d.level === "info");

  if (errors.length === 0 && warnings.length === 0 && infos.length === 0) {
    body.push("  Aucun diagnostic disponible.");
    return panel("DIAGNOSTICS CENTER", ANSI.red, body, width, enabled);
  }

  if (errors.length > 0) {
    body.push(`  ${paint("ERREURS", ANSI.red + ANSI.bold, enabled)}`);
    for (const d of errors.slice(0, 5)) {
      body.push(
        `    ${paint(d.code, ANSI.red, enabled)}  ${d.message}`
      );
    }
    body.push("");
  }

  if (warnings.length > 0) {
    body.push(`  ${paint("AVERTISSEMENTS", ANSI.amber + ANSI.bold, enabled)}`);
    for (const d of warnings.slice(0, 5)) {
      body.push(
        `    ${paint(d.code, ANSI.amber, enabled)}  ${d.message}`
      );
    }
    body.push("");
  }

  if (infos.length > 0) {
    body.push(`  ${paint("INFORMATIONS", ANSI.green + ANSI.bold, enabled)}`);
    for (const d of infos.slice(0, 3)) {
      body.push(
        `    ${paint(d.code, ANSI.green, enabled)}  ${d.message}`
      );
    }
  }

  return panel("DIAGNOSTICS CENTER", ANSI.red, body, width, enabled);
}
