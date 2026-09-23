import * as fs from "node:fs";
import * as path from "node:path";

export interface CompositionContextConfig {
  id: string;
  version: string;
}

export interface CompositionCapabilityConfig {
  id: string;
}

export interface CompositionDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  contexts: CompositionContextConfig[];
  capabilities: CompositionCapabilityConfig[];
}

export class CompositionManager {
  private static compositions = new Map<string, CompositionDefinition>();
  private static activeCompositionId: string = process.env.MOSAIX_COMPOSITION || "community-platform";

  static loadAll(compositionsDir: string = path.resolve(process.cwd(), "config/compositions")): Map<string, CompositionDefinition> {
    if (!fs.existsSync(compositionsDir)) {
      return this.compositions;
    }

    const files = fs.readdirSync(compositionsDir);
    for (const file of files) {
      if (file.endsWith(".json")) {
        try {
          const filePath = path.join(compositionsDir, file);
          const raw = fs.readFileSync(filePath, "utf-8");
          const def = JSON.parse(raw) as CompositionDefinition;
          if (def.id) {
            this.compositions.set(def.id, def);
          }
        } catch (err) {
          console.warn(`[composition] Failed to parse composition file: ${file}`, err);
        }
      }
    }
    return this.compositions;
  }

  static listCompositions(): CompositionDefinition[] {
    if (this.compositions.size === 0) {
      this.loadAll();
    }
    return Array.from(this.compositions.values());
  }

  static getComposition(id: string): CompositionDefinition | undefined {
    if (this.compositions.size === 0) {
      this.loadAll();
    }
    return this.compositions.get(id);
  }

  static getActiveComposition(): CompositionDefinition | undefined {
    return this.getComposition(this.activeCompositionId);
  }

  static setActiveComposition(id: string): boolean {
    if (this.compositions.size === 0) {
      this.loadAll();
    }
    if (this.compositions.has(id)) {
      this.activeCompositionId = id;
      return true;
    }
    return false;
  }

  static isAppActiveInComposition(appId: string): boolean {
    const active = this.getActiveComposition();
    if (!active) return true; // Default allow all if no composition configured
    const cleanId = appId.startsWith("@apps/") ? appId : `@apps/${appId}`;
    return active.contexts.some((ctx) => ctx.id === cleanId || ctx.id === appId);
  }
}
