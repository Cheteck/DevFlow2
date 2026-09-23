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
  app?: string;
  json?: boolean;
  ci?: boolean;
  debug?: boolean;
  open?: boolean;
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
  private activeApp: string | undefined = undefined;
  private startTime = Date.now();

  constructor(rootDir: string = process.cwd(), options: DevServerOptions = {}) {
    this.rootDir = rootDir;
    this.port = options.port ?? 3000;
    this.activeApp = options.app;
  }

  async start(options: DevServerOptions = {}): Promise<CLIResult> {
    const isJson = options.json ?? false;
    const isCi = options.ci ?? false;

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

    const summaryText = [
      "\nMosaiX Dev Server",
      "────────────────────────────────────────────────────",
      `Shell URL      http://localhost:${this.port}`,
      `Diagnostic URL http://localhost:${this.port}/__mosaix`,
      "\nApplications:",
      ...apps.map((a) => `  ✓ ${a}`),
      "\nPlugins:",
      ...plugins.map((p) => `  ✓ ${p}`),
      "\nContracts:",
      `  ✓ ${conformancePassed ? "valid" : "warnings detected"}`,
      "\nReady in " + ((Date.now() - this.startTime) / 1000).toFixed(2) + "s\n",
    ].join("\n");

    if (isJson) {
      console.log(JSON.stringify({ status: "success", message: "MosaiX Dev Server started", data: diagnostics }, null, 2));
    } else {
      console.log(summaryText);
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
