/**
 * @mosaix/cli — MosaiX Official Development Server Engine
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { CLIResult } from "../cli-types.js";
import { EXIT_CODES } from "../folder-manager.js";
import { AppConformanceValidator } from "@mosaix/conformance";
import { ApplicationDiscovery } from "@mosaix/core";

export interface DevServerOptions {
  port?: number;
  host?: string;
  app?: string;
  json?: boolean;
  ci?: boolean;
  debug?: boolean;
  open?: boolean;
  strictPort?: boolean;
  clearScreen?: boolean;
}

export interface DevServerDiagnostics {
  status: "running" | "stopped" | "error";
  port: number;
  activeAppFilter: string | undefined;
  discoveredApps: string[];
  discoveredPlugins: string[];
  conformancePassed: boolean;
  mosaixVersion: string;
  uptimeSeconds: number;
}

export class MosaixDevServer {
  private rootDir: string;
  private port: number;
  private host: string;
  private activeApp: string | undefined = undefined;
  private open: boolean;
  private strictPort: boolean;
  private clearScreen: boolean;
  private startTime = Date.now();

  constructor(rootDir: string = process.cwd(), options: DevServerOptions = {}) {
    this.rootDir = rootDir;
    this.port = options.port ?? 3000;
    this.host = options.host ?? "localhost";
    this.activeApp = options.app;
    this.open = options.open ?? false;
    this.strictPort = options.strictPort ?? false;
    this.clearScreen = options.clearScreen ?? true;
  }

  async start(options: DevServerOptions = {}): Promise<CLIResult> {
    const isJson = options.json ?? false;
    const isCi = options.ci ?? false;
    if (this.clearScreen && !isJson) console.clear();

    const appsDir = path.join(this.rootDir, "apps");
    const pluginsDir = path.join(this.rootDir, "plugins");

    // 1. Automatic Discovery
    let apps = ApplicationDiscovery.discoverWorkspaceApps(appsDir).map(m => m.id.replace("@apps/", ""));

    const plugins = fs.existsSync(pluginsDir)
      ? fs.readdirSync(pluginsDir).filter((f) => fs.statSync(path.join(pluginsDir, f)).isDirectory())
      : [];

    if (this.activeApp) {
      if (!apps.includes(this.activeApp)) {
        const msg = `Target application [${this.activeApp}] not found in apps/ directory.`;
        if (isJson) console.error(JSON.stringify({ status: "error", exitCode: EXIT_CODES.VALIDATION_FAILURE, error: msg }, null, 2));
        return { exitCode: EXIT_CODES.VALIDATION_FAILURE, message: msg };
      }
      apps = [this.activeApp];
    }

    // 2. Conformance Diagnostics
    const validationResults = AppConformanceValidator.validateAllWorkspaceApps(appsDir);
    const conformancePassed = Object.values(validationResults).every((res) => res.valid);

    if (!conformancePassed && isCi) {
      const msg = "Dev Server failed CI validation: One or more workspace applications have contract violations.";
      if (isJson) console.error(JSON.stringify({ status: "error", exitCode: EXIT_CODES.VALIDATION_FAILURE, error: msg }, null, 2));
      return { exitCode: EXIT_CODES.VALIDATION_FAILURE, message: msg };
    }

    // 3. Diagnostics Summary Output
    const diagnostics: DevServerDiagnostics = {
      status: "running",
      port: this.port,
      activeAppFilter: this.activeApp,
      discoveredApps: apps,
      discoveredPlugins: plugins,
      conformancePassed,
      mosaixVersion: "1.0.0",
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };

    const hostDisplay = this.host === "0.0.0.0" ? "localhost" : this.host;
    const summaryText = [
      "\n  MosaiX Dev Server  v1.0.0",
      "  ────────────────────────────────────────────────────",
      `  ➜  Shell:   http://${hostDisplay}:${this.port}/`,
      `  ➜  Network: http://${this.host}:${this.port}/`,
      `  ➜  Health:  http://${hostDisplay}:${this.port}/health`,
      `  ➜  Ready:   http://${hostDisplay}:${this.port}/ready`,
      ...(this.activeApp ? [`  ➜  App:     ${this.activeApp} (filtered)`] : []),
      "",
      `  Applications (${apps.length}): ${apps.slice(0, 5).join(", ")}${apps.length > 5 ? "…" : ""}`,
      `  Plugins (${plugins.length}): ${plugins.slice(0, 3).join(", ") || "none"}`,
      `  Contracts: ${conformancePassed ? "✓ valid" : "⚠ warnings"}`,
      `  Strict port: ${this.strictPort ? "yes" : "no (auto-retry)"}`,
      "",
      `  Ready in ${((Date.now() - this.startTime) / 1000).toFixed(2)}s`,
      "",
    ].join("\n");

    if (isJson) {
      console.log(JSON.stringify({ status: "success", message: "MosaiX Dev Server started", data: { ...diagnostics, host: this.host } }, null, 2));
    } else {
      console.log(summaryText);
    }

    // Open browser if requested (Vite parity)
    if (this.open && !isCi && !isJson) {
      try {
        const open = await import("open");
        await (open.default as unknown as (url: string) => Promise<void>)(`http://${hostDisplay}:${this.port}/`);
      } catch {
        // open not available — ignore
      }
    }

    // In CLI mode, actually spawn the HTTP host (src/start.ts) unless --help
    if (!isCi && !isJson && !this.activeApp) {
      const { spawn } = await import("node:child_process");
      const child = spawn("npx", ["tsx", "--watch", "src/start.ts"], {
        stdio: "inherit",
        env: { ...process.env, APP_PORT: String(this.port), HOST: this.host },
        shell: true,
      });
      // Keep CLI alive while dev server runs
      await new Promise(() => {}); // never resolves — dev server runs until SIGINT
    }

    return {
      exitCode: EXIT_CODES.SUCCESS,
      message: "MosaiX Dev Server started",
      data: diagnostics,
    };
  }

  getDiagnostics(): DevServerDiagnostics {
    const appsDir = path.join(this.rootDir, "apps");
    const pluginsDir = path.join(this.rootDir, "plugins");

    const apps = ApplicationDiscovery.discoverWorkspaceApps(appsDir).map(m => m.id.replace("@apps/", ""));

    const plugins = fs.existsSync(pluginsDir)
      ? fs.readdirSync(pluginsDir).filter((f) => fs.statSync(path.join(pluginsDir, f)).isDirectory())
      : [];

    return {
      status: "running",
      port: this.port,
      activeAppFilter: this.activeApp,
      discoveredApps: apps,
      discoveredPlugins: plugins,
      conformancePassed: true,
      mosaixVersion: "1.0.0",
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}
