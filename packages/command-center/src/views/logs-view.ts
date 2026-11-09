/**
 * @mosaix/command-center — Log Explorer View (Lot 01 - Refonte d'interface).
 *
 * Affiche les logs récents avec filtrage par service et niveau.
 * Consomme le snapshot existant (Snapshot.logs).
 */
import type { CommandCenterSnapshot } from "../supervisor-types.js";
import { formatClock } from "../format.js";
import { ANSI, paint } from "../theme.js";
import { panel } from "../cockpit.js";
import { ViewRenderer } from "./view-types.js";

export function renderLogsPanel(
  snapshot: CommandCenterSnapshot,
  width: number,
  enabled: boolean
): string[] {
  const body: string[] = [];

  body.push(`  ${paint("LOG EXPLORER", ANSI.bold, enabled)}`);
  body.push("");

  const logs = snapshot.logs;
  if (logs.length === 0) {
    body.push("  Aucun log disponible.");
    return panel("LOG EXPLORER", ANSI.blue, body, width, enabled);
  }

  // Afficher les 10 derniers logs
  const recent = logs.slice(-10);
  for (const l of recent) {
    const levelColor =
      l.level === "error"
        ? ANSI.red
        : l.level === "warn"
          ? ANSI.amber
          : l.level === "info"
            ? ANSI.green
            : ANSI.grey;
    const serviceColor =
      l.service === "api"
        ? ANSI.green
        : l.service === "mcp"
          ? ANSI.cyan
          : ANSI.grey;
    body.push(
      `  ${paint(formatClock(l.at), ANSI.grey, enabled)} ${paint(l.service, serviceColor, enabled)} [${l.stream}] ${paint(l.text, levelColor, enabled)}`
    );
  }

  return panel("LOG EXPLORER", ANSI.blue, body, width, enabled);
}
