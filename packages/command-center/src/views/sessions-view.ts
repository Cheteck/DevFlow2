/**
 * @mosaix/command-center — Session History View (Lot 01 - Refonte d'interface).
 *
 * Affiche la chronologie des événements et redémarrages.
 * Consomme le snapshot existant (snapshot.events et snapshot.cycles).
 */
import type { CommandCenterSnapshot } from "../supervisor-types.js";
import { formatClock, formatDuration } from "../format.js";
import { ANSI, paint } from "../theme.js";
import { panel } from "../cockpit.js";
import { ViewRenderer } from "./view-types.js";

export function renderSessionsPanel(
  snapshot: CommandCenterSnapshot,
  width: number,
  enabled: boolean
): string[] {
  const body: string[] = [];

  body.push(`  ${paint("SESSION HISTORY", ANSI.bold, enabled)}`);
  body.push("");

  // Événements récents
  body.push(`  ${paint("Événements récents:", ANSI.bold, enabled)}`);
  const events = snapshot.events.slice(-10);
  if (events.length === 0) {
    body.push("    Aucun événement.");
  } else {
    for (const e of events) {
      body.push(
        `    ${paint(formatClock(e.at), ANSI.grey, enabled)} [${e.category}] ${e.message}`
      );
    }
  }
  body.push("");

  // Cycles de redémarrage
  body.push(`  ${paint("Redémarrages récents:", ANSI.bold, enabled)}`);
  const cycles = snapshot.cycles.slice(-5);
  if (cycles.length === 0) {
    body.push("    Aucun cycle de redémarrage.");
  } else {
    for (const c of cycles) {
      const total =
        c.endedAt !== null ? c.endedAt - c.startedAt : 0;
      body.push(
        `    #${String(c.id).padStart(3, "0")} ${paint(c.outcome, c.outcome === "completed" ? ANSI.green : ANSI.red, enabled)} ${formatDuration(total)}  ${c.scope} — ${c.reason}`
      );
    }
  }

  return panel("SESSION HISTORY", ANSI.violet, body, width, enabled);
}
