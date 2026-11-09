/**
 * @mosaix/command-center — Environment View (Lot 01 - Refonte d'interface).
 *
 * Affiche l'état du watcher d'environnement et la configuration.
 * Consomme le snapshot existant (snapshot.watch).
 */
import type { CommandCenterSnapshot } from "../supervisor-types.js";
import { ANSI, paint } from "../theme.js";
import { panel } from "../cockpit.js";
import { ViewRenderer } from "./view-types.js";

export function renderEnvironmentPanel(
  snapshot: CommandCenterSnapshot,
  width: number,
  enabled: boolean
): string[] {
  const body: string[] = [];

  body.push(`  ${paint("ENVIRONMENT", ANSI.bold, enabled)}`);
  body.push("");

  const watch = snapshot.watch;
  body.push(`  ${paint("Fichiers surveillés:", ANSI.bold, enabled)} ${watch.watched.join(", ") || "aucun"}`);
  body.push(
    `  ${paint("Watcher actif:", ANSI.bold, enabled)} ${watch.active ? paint("OUI", ANSI.green, enabled) : paint("NON", ANSI.red, enabled)}`
  );
  body.push(
    `  ${paint("En pause:", ANSI.bold, enabled)} ${watch.paused ? paint("OUI", ANSI.amber, enabled) : paint("NON", ANSI.green, enabled)}`
  );
  body.push(
    `  ${paint("Dernier événement:", ANSI.bold, enabled)} ${watch.lastEvent || "aucun"}`
  );
  body.push("");

  body.push(`  ${paint("Raccourcis:", ANSI.grey, enabled)}  ${paint("P", ANSI.amber, enabled)}=pause/resume watch  ${paint("1", ANSI.amber, enabled)}=dashboard`);

  return panel("ENVIRONMENT", ANSI.blue, body, width, enabled);
}
