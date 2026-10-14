/**
 * @mosaix/dev-server — centralized cockpit palette.
 *
 * Stable meaning everywhere: cyan = identity/infrastructure, blue = info,
 * violet = processes/sessions, green = healthy/confirmed, amber = warning
 * or unknown readiness, red = critical/failed, grey = secondary metadata.
 * With NO_COLOR/CI every paint is a pass-through (borders stay unicode —
 * they are structural, not color).
 */

export const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  violet: "\x1b[35m",
  green: "\x1b[32m",
  amber: "\x1b[33m",
  red: "\x1b[31m",
  grey: "\x1b[90m",
  white: "\x1b[37m",
} as const;

export function colorsEnabled(): boolean {
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.CI !== undefined) return false;
  return true;
}

export function paint(text: string, code: string, enabled: boolean): string {
  if (!enabled) return text;
  return `${code}${text}${ANSI.reset}`;
}

export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Visible width (ANSI escapes excluded). */
export function vlen(text: string): number {
  return stripAnsi(text).length;
}

export const SYMBOLS = {
  brand: "◆",
  dot: "●",
  incident: "✖",
  ok: "✓",
  warn: "▲",
  timeline: "◷",
  logs: "≡",
  restart: "↻",
  borderV: "│",
} as const;
