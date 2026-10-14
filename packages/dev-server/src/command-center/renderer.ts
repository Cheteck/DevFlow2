/**
 * @mosaix/dev-server — cockpit grid composer (MOSAIX // COMMAND CENTER).
 *
 * Turns the live snapshot into a multi-panel frame: header bar, adaptive
 * 3/2/1-column grid of bordered panels, command palette overlay, help
 * overlay, status bar. Pure function of (snapshot, filters, dimensions) —
 * the TerminalRenderer owns all screen lifecycle (in-place repaint, VT
 * gate, cleanup). No supervision logic lives here.
 */
import {
  computeLayout,
  columnWidths,
  cockpitWeights,
  type PanelBudget,
} from "./layout.js";
import {
  headerBar,
  infrastructurePanel,
  fleetPanel,
  vitalsPanel,
  sessionsPanel,
  diagnosticsPanel,
  logsPanel,
  logsCollapsedPanel,
  restartsPanel,
  statusBar,
  panel,
  fitLine,
  type Panel,
} from "./cockpit.js";
import { ANSI, paint, colorsEnabled } from "./theme.js";
import { filterPalette, clampIndex } from "./palette.js";
import type { ViewFilters, CommandCenterSnapshot } from "./supervisor-types.js";

export type { ViewFilters } from "./supervisor-types.js";
export { stripAnsi } from "./theme.js";
export { isUp } from "./cockpit.js";

export const DEFAULT_FILTERS: ViewFilters = {
  showLogs: false,
  errorOnly: false,
  serviceFilter: "all",
  showHelp: false,
  paused: false,
  logScroll: 0,
  paletteOpen: false,
  paletteQuery: "",
  paletteIndex: 0,
};

export interface RenderOptions {
  width?: number;
  height?: number;
  forceColor?: boolean;
}

function buildPanel(
  id: string,
  snapshot: CommandCenterSnapshot,
  filters: ViewFilters,
  width: number,
  budget: PanelBudget,
  diagItems: number,
  compact: boolean,
  enabled: boolean,
): Panel {
  switch (id) {
    case "infrastructure":
      return infrastructurePanel(
        snapshot,
        width,
        enabled,
        filters.serviceFilter,
      );
    case "fleet":
      return fleetPanel(
        snapshot,
        width,
        enabled,
        filters.serviceFilter,
        compact,
      );
    case "vitals":
      return vitalsPanel(snapshot, width, enabled, compact);
    case "sessions":
      return sessionsPanel(
        snapshot.events,
        width,
        budget.timelineRows,
        enabled,
      );
    case "diagnostics":
      return diagnosticsPanel(snapshot.diagnostics, width, diagItems, enabled);
    case "logs":
      return filters.showLogs
        ? logsPanel(snapshot.logs, filters, width, budget.logRows, enabled)
        : logsCollapsedPanel(snapshot.logs.length, filters, width, enabled);
    case "restarts":
      return restartsPanel(
        snapshot.cycles,
        width,
        budget.cycleRows,
        budget.showCycleBars,
        enabled,
      );
    default:
      return { id, lines: [] };
  }
}

function paletteOverlay(
  filters: ViewFilters,
  width: number,
  enabled: boolean,
): string[] {
  const matches = filterPalette(filters.paletteQuery);
  const index = clampIndex(filters.paletteIndex, matches.length);
  const body: string[] = [
    `  ${paint("›", ANSI.cyan + ANSI.bold, enabled)} ${filters.paletteQuery}▊`,
  ];
  if (matches.length === 0) {
    body.push(paint("  no matching command", ANSI.grey, enabled));
  } else {
    for (const [i, cmd] of matches.slice(0, 6).entries()) {
      const marker =
        i === index ? paint("›", ANSI.cyan + ANSI.bold, enabled) : " ";
      const label =
        i === index ? paint(cmd.label, ANSI.bold, enabled) : cmd.label;
      body.push(
        `  ${marker} ${label} ${paint(`[${cmd.hint}]`, ANSI.grey, enabled)}`,
      );
    }
  }
  return panel(
    "COMMAND PALETTE · type · ↑↓ · enter · esc",
    ANSI.cyan,
    body,
    width,
    enabled,
  );
}

function helpOverlay(width: number, enabled: boolean): string[] {
  const rows: Array<Array<[string, string]>> = [
    [
      ["R", "safe restart"],
      ["L", "expand/collapse logs"],
      ["E", "error-only filter"],
    ],
    [
      ["C", "clear log view"],
      ["P", "pause/resume watch"],
      ["1 / 2", "filter api / mcp"],
    ],
    [
      ["↑ / ↓", "scroll logs"],
      ["Ctrl+K", "command palette"],
      ["Q · Ctrl+C", "graceful quit"],
    ],
  ];
  const col = Math.floor(width / 3);
  const body = rows.map((row) =>
    row
      .map(
        ([k, d]) =>
          `${paint(k.padEnd(9), ANSI.white, enabled)}${paint(d, ANSI.grey, enabled)}`,
      )
      .map((cell, i) =>
        i < row.length - 1 ? fitLine(cell, col, enabled) : cell,
      )
      .join(""),
  );
  return panel("SHORTCUTS", ANSI.grey, body, width, enabled);
}

export function renderCommandCenter(
  snapshot: CommandCenterSnapshot,
  filters: ViewFilters,
  options?: RenderOptions,
): string {
  const enabled = options?.forceColor ?? colorsEnabled();
  const width = Math.max(60, Math.min(options?.width ?? 100, 220));
  const height = Math.max(15, Math.min(options?.height ?? 40, 90));
  const layout = computeLayout(width, height);
  const widths = columnWidths(
    width,
    layout.columns,
    cockpitWeights(layout.columns),
  );

  // Height fit: shrink row budgets until the frame fits, prioritizing
  // incidents/services/events over logs and cycle history.
  const budget: PanelBudget = { ...layout.budget };
  let diagItems = height < 30 ? 1 : height < 40 ? 2 : 3;
  const compact = height < 30;
  const buildColumns = (): string[][] =>
    layout.grid.map((col, ci) =>
      col.flatMap(
        (id) =>
          buildPanel(
            id,
            snapshot,
            filters,
            widths[ci],
            budget,
            diagItems,
            compact,
            enabled,
          ).lines,
      ),
    );
  const chromeLines =
    2 + 1 + (filters.paletteOpen ? 9 : 0) + (filters.showHelp ? 5 : 0);
  let columns = buildColumns();
  for (let pass = 0; pass < 8; pass++) {
    const tallest = Math.max(...columns.map((c) => c.length));
    if (tallest + chromeLines <= height - 1) break;
    if (budget.timelineRows > 2) budget.timelineRows--;
    else if (filters.showLogs && budget.logRows > 3) budget.logRows--;
    else if (budget.cycleRows > 1) budget.cycleRows--;
    else if (diagItems > 1) diagItems--;
    else break;
    columns = buildColumns();
  }

  const lines: string[] = [];
  lines.push(...headerBar(snapshot, width, enabled));
  const tallest = Math.max(...columns.map((c) => c.length));
  const gutter = paint("│", ANSI.grey, enabled);
  for (let i = 0; i < tallest; i++) {
    lines.push(
      columns
        .map((col, ci) => fitLine(col[i] ?? "", widths[ci], enabled))
        .join(gutter),
    );
  }
  if (filters.paletteOpen) {
    lines.push(...paletteOverlay(filters, width, enabled));
  }
  if (filters.showHelp) {
    lines.push(...helpOverlay(width, enabled));
  }
  lines.push(...statusBar(filters, width, enabled));
  return lines.join("\n");
}
