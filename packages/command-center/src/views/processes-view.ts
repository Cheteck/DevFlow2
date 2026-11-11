/**
 * @mosaix/command-center — Process Explorer View (Lot 01 - Refonte d'interface).
 *
 * Affiche la liste des processus supervisés avec leurs états et permet
 * d'agir sur chacun (start/stop/restart). Consomme le snapshot existant.
 */
import type { CommandCenterSnapshot, ServiceName } from "../supervisor-types.js";
import { formatDuration } from "../format.js";
import { ANSI, paint } from "../theme.js";
import { panel } from "../cockpit.js";

export function renderProcessesPanel(
  snapshot: CommandCenterSnapshot,
  width: number,
  enabled: boolean
): string[] {
  const body: string[] = [];

  body.push(`  ${paint("PROCESS EXPLORER", ANSI.bold, enabled)}`);
  body.push("");

  if (snapshot.services.length === 0) {
    body.push("  Aucun processus supervisé.");
    return panel("PROCESS EXPLORER", ANSI.violet, body, width, enabled);
  }

  // En-tête de colonne
  body.push(
    `  ${paint("NOM", ANSI.bold, enabled)}  ${paint("ÉTAT", ANSI.bold, enabled)}  ${paint("READINESS", ANSI.bold, enabled)}  ${paint("PID", ANSI.bold, enabled)}  ${paint("UP", ANSI.bold, enabled)}  ${paint("RST", ANSI.bold, enabled)}  ${paint("EXIT", ANSI.bold, enabled)}`
  );
  body.push(
    `  ${"-".repeat(Math.min(width - 4, 80))}`
  );

  for (const s of snapshot.services) {
    const stateColor =
      s.state === "READY"
        ? ANSI.green
        : s.state === "FAILED" || s.state === "CRASHED"
          ? ANSI.red
          : s.state === "STOPPED"
            ? ANSI.grey
            : ANSI.amber;
    const readiness =
      s.readinessState === "READY"
        ? paint("ready", ANSI.green, enabled)
        : s.readinessState === "TIMEOUT"
          ? paint("timeout", ANSI.amber, enabled)
          : s.readinessState === "UNKNOWN"
            ? paint("unknown", ANSI.grey, enabled)
            : paint("pending", ANSI.grey, enabled);
    body.push(
      `  ${paint(s.name.toUpperCase(), ANSI.bold, enabled)}  ${paint(s.state, stateColor, enabled)}  ${readiness}  ${s.pid ?? "—"}  ${formatDuration(s.uptimeMs)}  ${s.restarts}  ${s.lastExitCode ?? "—"}`
    );
  }
  body.push("");
  body.push(
    `  ${paint("Raccourcis:", ANSI.grey, enabled)}  ${paint("s", ANSI.amber, enabled)}=stop  ${paint("a", ANSI.amber, enabled)}=start  ${paint("r", ANSI.amber, enabled)}=restart`
  );

  return panel("PROCESS EXPLORER", ANSI.violet, body, width, enabled);
}
