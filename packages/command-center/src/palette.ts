/**
 * @mosaix/command-center — Ctrl+K command palette model (pure, testable).
 *
 * Every entry executes a REAL supervisor action via its `run` key — the
 * renderer only displays, the supervisor dispatches. Fuzzy filter is a
 * case-insensitive subsequence match over id + label.
 */
export interface PaletteCommand {
  id: string;
  label: string;
  hint: string;
}

export const PALETTE_COMMANDS: PaletteCommand[] = [
  { id: "restart-all", label: "Restart all services", hint: "R" },
  { id: "restart-api", label: "Restart platform server", hint: "R 1" },
  { id: "restart-mcp", label: "Restart MCP server", hint: "R 2" },
  { id: "toggle-logs", label: "Expand / collapse logs", hint: "L" },
  { id: "toggle-errors", label: "Error-only log filter", hint: "E" },
  { id: "clear-logs", label: "Clear log view", hint: "C" },
  { id: "toggle-watch", label: "Pause / resume .env watch", hint: "P" },
  { id: "filter-api", label: "Filter: platform server", hint: "F" },
  { id: "filter-mcp", label: "Filter: MCP", hint: "F" },
  { id: "filter-all", label: "Filter: all services", hint: "F" },
  { id: "goto-dashboard", label: "Go to Dashboard", hint: "1" },
  { id: "goto-processes", label: "Go to Processes", hint: "2" },
  { id: "goto-logs", label: "Go to Logs", hint: "3" },
  { id: "goto-diagnostics", label: "Go to Diagnostics", hint: "4" },
  { id: "goto-environment", label: "Go to Environment", hint: "5" },
  { id: "goto-sessions", label: "Go to Sessions", hint: "6" },
  { id: "toggle-help", label: "Show / hide help", hint: "?" },
  { id: "quit", label: "Quit (graceful shutdown)", hint: "Q" },
];

export function filterPalette(
  query: string,
  commands: PaletteCommand[] = PALETTE_COMMANDS,
): PaletteCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...commands];
  return commands.filter((cmd) => {
    const hay = `${cmd.id} ${cmd.label}`.toLowerCase();
    let qi = 0;
    for (let i = 0; i < hay.length && qi < q.length; i++) {
      if (hay[i] === q[qi]) qi++;
    }
    return qi === q.length;
  });
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}
