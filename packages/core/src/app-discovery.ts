/**
 * @mosaix/core — Application Discovery
 *
 * Scans workspace application directories and reads root mosaix.json manifests.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ApplicationManifest } from "@mosaix/contracts";
import { Invariants } from "./invariants";
import { RegistrationError } from "./kernel-errors";

export interface DiscoveredAppEntry {
  manifest: ApplicationManifest;
  sourcePath: string;
}

export class ApplicationDiscovery {
  private readonly discovered = new Map<string, DiscoveredAppEntry>();

  /**
   * Registre in-memory des manifests découverts (Phase 2.3) : valide,
   * rejette les doublons et les manifests invalides.
   */
  registerDiscovered(sourcePath: string, manifest: ApplicationManifest): DiscoveredAppEntry {
    try {
      Invariants.manifest(manifest);
    } catch (error) {
      throw new RegistrationError(
        `Invalid manifest discovered at "${sourcePath}": ${(error as Error).message}`,
        { sourcePath },
      );
    }
    const id = manifest.id;
    if (this.discovered.has(id)) {
      throw new RegistrationError(`Duplicate application ID: ${id}`, { appId: id, sourcePath });
    }
    const entry: DiscoveredAppEntry = { manifest, sourcePath };
    this.discovered.set(id, entry);
    return entry;
  }

  listDiscovered(): DiscoveredAppEntry[] {
    return Array.from(this.discovered.values());
  }

  getDiscovered(id: string): DiscoveredAppEntry | undefined {
    return this.discovered.get(id);
  }
  static discoverAppManifest(appDir: string): ApplicationManifest | null {
    const manifestPath = path.join(appDir, "mosaix.json");
    if (!fs.existsSync(manifestPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(manifestPath, "utf-8");
      return JSON.parse(content) as ApplicationManifest;
    } catch {
      return null;
    }
  }

  static discoverWorkspaceApps(appsRootDir: string): ApplicationManifest[] {
    if (!fs.existsSync(appsRootDir)) {
      return [];
    }

    const manifests: ApplicationManifest[] = [];
    const entries = fs.readdirSync(appsRootDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifest = this.discoverAppManifest(path.join(appsRootDir, entry.name));
        if (manifest) {
          manifests.push(manifest);
        }
      }
    }

    return manifests;
  }
}
