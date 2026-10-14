/**
 * @mosaix/dev-server — TerminalRenderer: single-owner VT screen painter.
 *
 * Root cause of the P0 duplication bug: the supervisor repainted with
 * `write("\x1b[2J\x1b[H" + frame)` on every event AND every second, assuming
 * the terminal honors Erase-Display. On a Windows CMD without VT processing
 * those sequences are ignored, so every frame APPENDED below the previous
 * one — N copies in seconds.
 *
 * Lifecycle contract (the actual fix, not a cosmetic mask):
 * - exactly ONE instance per session, created once, disposed once;
 * - in-place repaint via cursor addressing (`\x1b[{n}A` + `\x1b[K`), never
 *   full-screen erase per frame — no scrollback accumulation, no flicker;
 * - coalesced paints: bursts of render requests collapse into ONE paint
 *   (no timer created per refresh, no repeated subscriptions);
 * - capability gate (`vtSupported()`): terminals without ANSI fall back to
 *   text mode (owned by the supervisor) instead of printing escape garbage
 *   or duplicated frames;
 * - full cleanup on dispose: cursor restored, resize listener removed, no
 *   dangling timers.
 */
import * as os from "node:os";

export interface TtyStream {
  columns?: number;
  rows?: number;
  write(chunk: string): boolean;
  on(event: "resize", listener: () => void): void;
  off(event: "resize", listener: () => void): void;
}

/**
 * True when the current stdout can do cursor addressing. Conservative on
 * Windows: legacy conhost only qualifies on Win10+ (where Node enables
 * VIRTUAL_TERMINAL_PROCESSING on TTY handles); Windows Terminal / ConEmu /
 * ANSICON / VS Code terminal advertise themselves explicitly.
 */
export function vtSupported(stream?: { isTTY?: boolean }): boolean {
  if (process.env.NO_TUI !== undefined) return false;
  if (process.env.CI !== undefined) return false;
  if (process.env.TERM === "dumb") return false;
  const tty = stream?.isTTY ?? process.stdout.isTTY;
  if (!tty) return false;
  if (process.platform === "win32") {
    if (
      process.env.WT_SESSION !== undefined ||
      process.env.ANSICON !== undefined ||
      process.env.ConEmuANSI === "ON" ||
      process.env.TERM_PROGRAM !== undefined
    ) {
      return true;
    }
    const major = Number((os.release().split(".")[0] ?? "0").trim());
    return Number.isFinite(major) && major >= 10;
  }
  return true;
}

const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";
const ERASE_LINE = "\x1b[K";

export class TerminalRenderer {
  private active = false;
  private disposed = false;
  private firstPaint = true;
  private lastHeight = 0;
  private fullRedraw = false;
  private queued = false;
  private pendingProvider: (() => string) | null = null;
  private paintCount = 0;

  private readonly onResize = (): void => {
    // Dimensions changed: next paint does one full clear + fresh frame so
    // the cursor math restarts from a known origin.
    this.fullRedraw = true;
    this.requestPaint();
  };

  constructor(private readonly stream: TtyStream) {}

  get paints(): number {
    return this.paintCount;
  }

  get isActive(): boolean {
    return this.active && !this.disposed;
  }

  /** One-time activation: hides cursor, subscribes resize exactly once. */
  start(): void {
    if (this.active || this.disposed) return;
    this.active = true;
    this.stream.on("resize", this.onResize);
    this.stream.write(HIDE_CURSOR);
  }

  /**
   * Coalesced repaint request. Bursts collapse into a single paint on the
   * next immediate tick; the FRESHEST provider wins. No timers created.
   */
  requestPaint(provider?: () => string): void {
    if (!this.active || this.disposed) return;
    if (provider) this.pendingProvider = provider;
    if (this.queued) return;
    this.queued = true;
    setImmediate(() => {
      this.queued = false;
      if (!this.active || this.disposed) return;
      const makeFrame = this.pendingProvider;
      this.pendingProvider = null;
      if (!makeFrame) return;
      this.paint(makeFrame());
    });
  }

  /**
   * Synchronous in-place repaint. First frame prints as-is; later frames
   * move the cursor back up to the frame origin and rewrite line by line.
   * Shorter frames explicitly erase leftover lines. Frames taller than the
   * viewport cannot be addressed reliably → one full clear for that paint.
   */
  paint(frame: string): void {
    if (!this.active || this.disposed) return;
    const rows = this.stream.rows ?? 40;
    const lines = frame.split("\n");
    this.paintCount += 1;

    if (this.firstPaint && !this.fullRedraw) {
      this.firstPaint = false;
      this.lastHeight = lines.length;
      this.stream.write(`${frame}\n`);
      return;
    }
    if (lines.length >= Math.max(4, rows - 1)) {
      // Taller than the viewport: re-anchor with a single full clear.
      this.lastHeight = lines.length;
      this.fullRedraw = false;
      this.stream.write(`\x1b[2J\x1b[H${frame}\n`);
      return;
    }
    if (this.fullRedraw) {
      this.fullRedraw = false;
      this.lastHeight = lines.length;
      this.stream.write(`\x1b[2J\x1b[H${frame}\n`);
      return;
    }

    const height = Math.max(lines.length, 1);
    const previous = Math.max(this.lastHeight, 1);
    // Cursor is parked on the line right AFTER the frame (every paint ends
    // there, including the first). Go back up to the frame origin…
    let out = `\x1b[${previous}A\r`;
    const total = Math.max(height, previous);
    for (let i = 0; i < total; i++) {
      out += `\r${ERASE_LINE}`;
      if (i < lines.length) out += lines[i];
      if (i < total - 1) out += "\n";
    }
    // …and re-park after the (possibly shorter/taller) new frame so the
    // next repaint starts from the same invariant.
    const overshoot = total - height;
    if (overshoot > 0) out += `\r\x1b[${overshoot}A`;
    else out += "\n";
    this.lastHeight = height;
    this.stream.write(out);
  }

  /** Full cleanup: cursor restored, resize unsubscribed, queue dropped. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.active = false;
    this.pendingProvider = null;
    this.queued = false;
    try {
      this.stream.off("resize", this.onResize);
    } catch {
      /* listener already gone */
    }
    this.stream.write(`\n${SHOW_CURSOR}`);
  }
}
