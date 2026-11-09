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

export function renderLogsPanel(
  snapshot: CommandCenterSnapshot,
  width: number,
  enabled: boolean,
  height?: number,
): string[] {
  const body: string[] = [];

  body.push(`  ${paint("LOG EXPLORER", ANSI.bold, enabled)}`);
  body.push("");

  const logs = snapshot.logs;
  if (logs.length === 0) {
    body.push("  Aucun log disponible.");
    return panel("LOG EXPLORER", ANSI.blue, body, width, enabled);
  }

  // Nombre de lignes adaptatif à la hauteur du terminal
  const maxLines = Math.max(5, (height ?? 40) - 8);
  const recent = logs.slice(-maxLines);
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
