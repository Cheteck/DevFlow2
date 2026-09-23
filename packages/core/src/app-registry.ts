import type { ApplicationManifest } from "@mosaix/contracts";
import { AppLifecycle, type LifecycleCallbacks } from "./lifecycle";

export interface AppRegistryEntry {
  manifest: ApplicationManifest;
  lifecycle: AppLifecycle;
}

export class ApplicationRegistry {
  private readonly apps = new Map<string, AppRegistryEntry>();

  register(
    manifest: ApplicationManifest,
    deps?: LifecycleCallbacks,
  ): void {
    if (this.apps.has(manifest.id)) {
      throw new Error(
        `Application [${manifest.id}] is already registered.`,
      );
    }
    this.apps.set(manifest.id, {
      manifest,
      lifecycle: new AppLifecycle(deps),
    });
  }

  get(id: string): AppRegistryEntry | undefined {
    return this.apps.get(id);
  }

  has(id: string): boolean {
    return this.apps.has(id);
  }

  getStatus(id: string): string | undefined {
    return this.apps.get(id)?.lifecycle.status;
  }

  list(): ApplicationManifest[] {
    return Array.from(this.apps.values()).map((e) => e.manifest);
  }

  entries(): AppRegistryEntry[] {
    return Array.from(this.apps.values());
  }

  clear(): void {
    this.apps.clear();
  }
}

export { ApplicationRegistry as AppRegistry };
export type { AppRegistryEntry as AppEntry };
