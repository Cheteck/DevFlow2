/**
 * @mosaix/dev-server — adaptive cockpit grid.
 *
 * Pure layout computation (no I/O, no rendering): from real terminal
 * dimensions to panel placement + row budgets. Three columns on wide
 * terminals, two on medium, one stacked column on narrow. Short screens
 * prioritize incidents/services/events by shrinking timeline and logs first.
 */
export type Columns = 1 | 2 | 3;

export interface PanelBudget {
  timelineRows: number;
  logRows: number;
  cycleRows: number;
  showCycleBars: boolean;
}

export interface CockpitLayout {
  columns: Columns;
  /** Panel placement order per column (panel ids). */
  grid: string[][];
  budget: PanelBudget;
}

export function columnsForWidth(width: number): Columns {
  if (width >= 120) return 3;
  if (width >= 85) return 2;
  return 1;
}

export function computeLayout(width: number, height: number): CockpitLayout {
  const columns = columnsForWidth(width);
  const short = height < 30;
  const budget: PanelBudget = {
    timelineRows: short ? 3 : height < 40 ? 5 : 7,
    logRows: short ? 4 : height < 40 ? 8 : 12,
    cycleRows: short ? 3 : 5,
    showCycleBars: width >= 100,
  };
  let grid: string[][];
  if (columns === 3) {
    // Balanced stacks (~16 rows each with collapsed logs): infra+fleet,
    // activity+logs+vitals, incidents+history. No panel twice.
    grid = [
      ["infrastructure", "fleet"],
      ["sessions", "logs", "vitals"],
      ["diagnostics", "restarts"],
    ];
  } else if (columns === 2) {
    grid = [
      ["infrastructure", "fleet", "vitals"],
      ["sessions", "diagnostics", "logs", "restarts"],
    ];
  } else {
    grid = [
      [
        "infrastructure",
        "diagnostics",
        "sessions",
        "logs",
        "fleet",
        "restarts",
        "vitals",
      ],
    ];
  }
  return { columns, grid, budget };
}

/** Column widths (chars) for N columns across `width`, 1-char gutters. */
export function columnWidths(
  width: number,
  columns: Columns,
  weights?: number[],
): number[] {
  const gutter = columns - 1;
  const usable = Math.max(20, width - gutter);
  const w =
    weights && weights.length === columns
      ? weights
      : new Array<number>(columns).fill(1 / columns);
  const total = w.reduce((a, b) => a + b, 0);
  const widths = w.map((weight) => Math.floor((usable * weight) / total));
  // Widest column absorbs rounding remainder (deliberate asymmetry).
  let remainder = usable - widths.reduce((a, b) => a + b, 0);
  const i = widths.indexOf(Math.max(...widths));
  while (remainder > 0) {
    widths[i]++;
    remainder--;
  }
  return widths;
}

/** Asymmetric cockpit weights: the central column carries logs/activity. */
export function cockpitWeights(columns: Columns): number[] {
  if (columns === 3) return [0.29, 0.42, 0.29];
  if (columns === 2) return [0.38, 0.62];
  return [1];
}
