/**
 * @mosaix/command-center — Dashboard View (Lot 01 - Refonte d'interface).
 *
 * Vue principale du Developer Console. Affiche l'état global du système :
 * statut du Supervisor, processus, métriques clés, activité récente.
 * Ne crée pas de nouvelles données : consomme le snapshot existant.
 */
import type { CommandCenterSnapshot } from "../supervisor-types.js";
import { formatClock, formatDuration } from "../format.js";
import { ANSI, paint } from "../theme.js";
import { panel } from "../cockpit.js";
import type { ViewRenderer } from "./view-types.js";

/**
 * Rend le Dashboard : statut global, processus, activité récente, métriques.
 */
export function renderDashboard(
  snapshot: CommandCenterSnapshot,
  width: number,
  enabled: boolean
): string[] {
  const body: string[] = [];

  // Ligne 1 : statut global
  const overallColor =
    snapshot.overall === "OPERATIONAL"
      ? ANSI.green
      : snapshot.overall === "STARTING"
        ? ANSI.amber
        : snapshot.overall === "DEGRADED"
          ? ANSI.amber
          : ANSI.red;
  body.push(
    `  ${paint("SUPERVISOR", ANSI.bold, enabled)}  ${paint(snapshot.overall, overallColor + ANSI.bold, enabled)}  ${paint("UPTIME", ANSI.grey, enabled)} ${formatDuration(snapshot.now - snapshot.startedAt)}`
  );
  body.push("");

  // Ligne 2 : processus
  body.push(`  ${paint("PROCESS FLEET", ANSI.bold, enabled)}`);
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
      `    ${paint(s.name.toUpperCase(), ANSI.bold, enabled)}  ${paint(s.state, stateColor, enabled)}  ${readiness}  PID ${s.pid ?? "—"}  UP ${formatDuration(s.uptimeMs)}  RST ${s.restarts}`
    );
  }
  body.push("");

  // Ligne 3 : activités récentes (derniers événements)
  body.push(`  ${paint("RECENT ACTIVITY", ANSI.bold, enabled)}`);
  const recentEvents = snapshot.events.slice(-5).reverse();
  if (recentEvents.length === 0) {
    body.push("    aucun événement récent");
  } else {
    for (const e of recentEvents) {
      body.push(
        `    ${paint(formatClock(e.at), ANSI.grey, enabled)} [${e.category}] ${e.message}`
      );
    }
  }
  body.push("");

  // Ligne 4 : diagnostics critiques
  const errors = snapshot.diagnostics.filter((d) => d.level === "error");
  body.push(`  ${paint("CRITICALS", ANSI.bold, enabled)}`);
  if (errors.length === 0) {
    body.push("    aucun incident critique");
  } else {
    for (const d of errors.slice(0, 3)) {
      body.push(`    ${paint(d.code, ANSI.red + ANSI.bold, enabled)}  ${d.message}`);
    }
  }

  return body;
}

export function renderDashboardPanel(
  snapshot: CommandCenterSnapshot,
  width: number,
  enabled: boolean
): string[] {
  const lines = renderDashboard(snapshot, width, enabled);
  return panel("DASHBOARD", ANSI.cyan, lines, width, enabled);
}