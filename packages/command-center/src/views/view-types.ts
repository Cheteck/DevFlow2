/**
 * @mosaix/command-center — View types (Lot 01 - Refonte d'interface).
 *
 * Types partagés entre toutes les vues du Developer Console.
 */
import type { CommandCenterSnapshot, ServiceName } from "../supervisor-types.js";

export interface ViewRenderer {
  render(snapshot: CommandCenterSnapshot, width: number, enabled: boolean): string[];
}

export interface ViewContext {
  activeView: string;
  selectedService: ServiceName | null;
  snapshot: CommandCenterSnapshot | null;
}

export interface ViewDefinition {
  id: string;
  label: string;
  description: string;
  icon: string;
  renderer: ViewRenderer;
}
