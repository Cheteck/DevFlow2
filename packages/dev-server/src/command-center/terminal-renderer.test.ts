/**
 * @mosaix/dev-server — TerminalRenderer lifecycle tests (P0 duplication bug).
 *
 * Proves: one instance paints in place (cursor addressing, never append),
 * bursts coalesce into a single paint, no timer per refresh, full cleanup.
 */
import { describe, it, expect, afterEach } from "vitest";
import { TerminalRenderer, vtSupported } from "./terminal-renderer.js";

class FakeStream {
  columns = 120;
  rows = 40;
  readonly writes: string[] = [];
  private listeners = new Map<string, Set<() => void>>();

  write(chunk: string): boolean {
    this.writes.push(chunk);
    return true;
  }

  on(event: "resize", listener: () => void): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
  }

  off(event: "resize", listener: () => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  resizeCount(): number {
    return this.listeners.get("resize")?.size ?? 0;
  }

  emitResize(): void {
    for (const listener of [...(this.listeners.get("resize") ?? [])]) {
      listener();
    }
  }
}

const flush = () => new Promise<void>((r) => setImmediate(r));

describe("vtSupported capability gate", () => {
  const saved: Record<string, string | undefined> = {};
  for (const key of ["CI", "NO_TUI", "TERM", "WT_SESSION"] as const) {
    saved[key] = process.env[key];
  }
  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("refuses non-VT terminals (they get text mode, never frame repaints)", () => {
    delete process.env.CI;
    delete process.env.NO_TUI;
    delete process.env.TERM;
    process.env.CI = "true";
    expect(vtSupported({ isTTY: true })).toBe(false);
    delete process.env.CI;
    process.env.NO_TUI = "1";
    expect(vtSupported({ isTTY: true })).toBe(false);
    delete process.env.NO_TUI;
    process.env.TERM = "dumb";
    expect(vtSupported({ isTTY: true })).toBe(false);
    delete process.env.TERM;
    expect(vtSupported({ isTTY: false })).toBe(false);
  });

  it("accepts a capable terminal", () => {
    delete process.env.CI;
    delete process.env.NO_TUI;
    delete process.env.TERM;
    expect(vtSupported({ isTTY: true })).toBe(true);
  });
});

describe("TerminalRenderer in-place repaint", () => {
  it("paints the first frame verbatim, repaints move the cursor up (no append)", async () => {
    const stream = new FakeStream();
    const screen = new TerminalRenderer(stream);
    screen.start();
    screen.requestPaint(() => "HEADER\nline-a\nline-b");
    await flush();
    screen.requestPaint(() => "HEADER\nline-a\nline-b");
    await flush();
    expect(stream.writes).toHaveLength(3); // hide-cursor + 2 paints
    expect(stream.writes[1]).toBe("HEADER\nline-a\nline-b\n");
    // Second paint returns to the frame origin instead of appending.
    expect(stream.writes[2].startsWith("\x1b[3A")).toBe(true);
    expect(stream.writes[2]).toContain("HEADER");
    screen.dispose();
  });

  it("collapses bursts into a single paint (no timer per refresh)", async () => {
    const stream = new FakeStream();
    const screen = new TerminalRenderer(stream);
    screen.start();
    for (let i = 0; i < 10; i++) {
      screen.requestPaint(() => `frame-${i}`);
    }
    await flush();
    expect(screen.paints).toBe(1);
    expect(stream.writes[stream.writes.length - 1]).toContain("frame-9");
    screen.dispose();
  });

  it("erases leftover lines when the frame shrinks", async () => {
    const stream = new FakeStream();
    const screen = new TerminalRenderer(stream);
    screen.start();
    screen.requestPaint(() => "one\ntwo\nthree\nfour");
    await flush();
    screen.requestPaint(() => "one");
    await flush();
    const repaint = stream.writes[stream.writes.length - 1];
    // 4 old lines rewritten/erased, cursor re-parked after the 1-line frame.
    // eslint-disable-next-line no-control-regex
    expect((repaint.match(/\x1b\[K/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(repaint).toContain("\x1b[3A");
    screen.dispose();
  });

  it("re-anchors with one full clear after resize or oversize frames", async () => {
    const stream = new FakeStream();
    const screen = new TerminalRenderer(stream);
    screen.start();
    screen.requestPaint(() => "a\nb");
    await flush();
    stream.emitResize();
    screen.requestPaint(() => "a\nb");
    await flush();
    expect(
      stream.writes[stream.writes.length - 1].startsWith("\x1b[2J\x1b[H"),
    ).toBe(true);
    // Oversize frame (taller than viewport) also re-anchors once.
    stream.rows = 4;
    screen.requestPaint(() => "1\n2\n3\n4\n5\n6");
    await flush();
    expect(
      stream.writes[stream.writes.length - 1].startsWith("\x1b[2J\x1b[H"),
    ).toBe(true);
    screen.dispose();
  });

  it("start is idempotent and dispose fully cleans up", async () => {
    const stream = new FakeStream();
    const screen = new TerminalRenderer(stream);
    screen.start();
    screen.start();
    expect(stream.resizeCount()).toBe(1);
    expect(stream.writes.filter((w) => w === "\x1b[?25l")).toHaveLength(1);
    screen.dispose();
    expect(stream.resizeCount()).toBe(0);
    expect(stream.writes[stream.writes.length - 1]).toContain("\x1b[?25h");
    const paintsBefore = screen.paints;
    screen.requestPaint(() => "late");
    await flush();
    expect(screen.paints).toBe(paintsBefore);
  });
});
