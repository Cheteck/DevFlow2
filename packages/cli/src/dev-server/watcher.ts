/**
 * @mosaix/cli — Development Server Workspace File Watcher
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface WatcherOptions {
  onDirectoryChange?: (changedPath: string) => void;
}

export class MosaixDevWatcher {
  private rootDir: string;
  private options: WatcherOptions;
  private watchers: fs.FSWatcher[] = [];

  constructor(rootDir: string = process.cwd(), options: WatcherOptions = {}) {
    this.rootDir = rootDir;
    this.options = options;
  }

  getWatchDirectories(): string[] {
    const dirs = ["apps", "plugins", "packages", "src"];
    return dirs
      .map((d) => path.join(this.rootDir, d))
      .filter((p) => fs.existsSync(p));
  }

  watch(): void {
    this.stop();
    for (const dir of this.getWatchDirectories()) {
      try {
        const w = fs.watch(dir, { recursive: true }, (_event, filename) => {
          if (filename && this.options.onDirectoryChange) {
            this.options.onDirectoryChange(path.join(dir, filename));
          }
        });
        this.watchers.push(w);
      } catch {
        // Suppress watch errors on non-supported environments
      }
    }
  }

  stop(): void {
    for (const w of this.watchers) {
      try {
        w.close();
      } catch {
        // Ignore close errors
      }
    }
    this.watchers = [];
  }

  simulateChange(targetPath: string): void {
    if (this.options.onDirectoryChange) {
      this.options.onDirectoryChange(targetPath);
    }
  }
}
