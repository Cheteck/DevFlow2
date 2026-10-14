/**
 * @mosaix/dev-server — robust .env file watcher.
 *
 * - Watches each file directly when present; otherwise watches the parent
 *   directory until the file is created (covers missing `.env.local`).
 * - Recreates watchers after `rename` events (atomic saves invalidate them).
 * - Debounces bursts into a single notification (default 300 ms).
 * - Never reads or prints file contents (secrets stay on disk).
 * - Pause/resume affects notifications only — process supervision continues.
 */
import * as fs from "node:fs";
import * as path from "node:path";

export type EnvFileKind = "changed" | "created" | "deleted" | "renamed";

export interface EnvFileEvent {
  file: string;
  kind: EnvFileKind;
  at: number;
}

export interface EnvWatcherOptions {
  root: string;
  files?: string[];
  debounceMs?: number;
  onEvent: (event: EnvFileEvent) => void;
  onWatchState?: (watched: string[], active: boolean) => void;
}

const DEFAULT_FILES = [".env", ".env.local"];

export class EnvWatcher {
  private readonly files: string[];
  private readonly debounceMs: number;
  private watchers: fs.FSWatcher[] = [];
  private debounce: NodeJS.Timeout | null = null;
  private pending: EnvFileEvent | null = null;
  private watched: string[] = [];
  private active = false;
  private paused = false;
  private disposed = false;
  private lastEvent: EnvFileEvent | null = null;

  constructor(private readonly opts: EnvWatcherOptions) {
    this.files = opts.files ?? DEFAULT_FILES;
    this.debounceMs = opts.debounceMs ?? 300;
  }

  start(): void {
    if (this.disposed) return;
    this.closeWatchers();
    this.watched = [];
    for (const file of this.files) {
      this.watchOne(file);
    }
    this.active = this.watchers.length > 0;
    this.opts.onWatchState?.([...this.watched], this.active);
  }

  private watchOne(file: string): void {
    const filePath = path.join(this.opts.root, file);
    try {
      if (fs.existsSync(filePath)) {
        const watcher = fs.watch(filePath, (eventType) => {
          // Atomic editors emit `rename` (replace) — the watcher is then
          // dead and must be recreated.
          if (eventType === "rename") {
            this.recreateWatcher(file);
            this.notify({
              file,
              kind: fs.existsSync(filePath) ? "renamed" : "deleted",
              at: Date.now(),
            });
            return;
          }
          this.notify({ file, kind: "changed", at: Date.now() });
        });
        watcher.on("error", () => {
          // A broken watcher must not kill supervision; retry via recreate.
          this.recreateWatcher(file);
        });
        this.watchers.push(watcher);
        this.watched.push(file);
      } else {
        // File absent: watch the directory for its creation.
        const dir = path.dirname(filePath);
        const base = path.basename(filePath);
        const dirWatcher = fs.watch(dir, (_event, name) => {
          if (String(name ?? "") !== base) return;
          if (fs.existsSync(filePath)) {
            this.notify({ file, kind: "created", at: Date.now() });
            this.recreateWatcher(file);
            this.opts.onWatchState?.([...this.watched], this.active);
          }
        });
        dirWatcher.on("error", () => undefined);
        this.watchers.push(dirWatcher);
      }
    } catch {
      // Unwatchable path: supervision continues; state stays honest.
      this.active = false;
      this.opts.onWatchState?.([...this.watched], false);
    }
  }

  private recreateWatcher(_file: string): void {
    // Drop and rebuild every watcher for simplicity: file count is tiny
    // (2) and events are debounced, so no listener pile-up is possible.
    this.closeWatchers();
    if (this.disposed) return;
    this.watched = [];
    for (const f of this.files) {
      if (this.disposed) break;
      this.watchOne(f);
    }
    this.active = this.watchers.length > 0;
    this.opts.onWatchState?.([...this.watched], this.active);
  }

  private notify(event: EnvFileEvent): void {
    this.lastEvent = event;
    if (this.paused || this.disposed) return;
    this.pending = event;
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      this.debounce = null;
      const fire = this.pending;
      this.pending = null;
      if (fire && !this.paused && !this.disposed) {
        this.opts.onEvent(fire);
      }
    }, this.debounceMs);
    this.debounce.unref?.();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get isActive(): boolean {
    return this.active && this.watchers.length > 0;
  }

  get watchedFiles(): string[] {
    return [...this.watched];
  }

  get lastFileEvent(): EnvFileEvent | null {
    return this.lastEvent;
  }

  dispose(): void {
    this.disposed = true;
    if (this.debounce) clearTimeout(this.debounce);
    this.closeWatchers();
    this.active = false;
  }

  private closeWatchers(): void {
    for (const watcher of this.watchers) {
      try {
        watcher.close();
      } catch {
        /* already closed */
      }
    }
    this.watchers = [];
  }
}
