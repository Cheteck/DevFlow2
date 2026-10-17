import { getGlobalPluginEngine } from "../../../../src/shell/plugin-engine-bootstrap.js";

export type PrestaPluginCategory =
  | "commerce"
  | "security"
  | "analytics"
  | "ui"
  | "workflow"
  | "administration";

export interface ImperiaPluginModule {
  id: string;
  name: string;
  author: string;
  version: string;
  category: PrestaPluginCategory;
  description: string;
  installed: boolean;
  enabled: boolean;
  configurable: boolean;
  configurationSchema?: Record<string, unknown>;
  configurationValues?: Record<string, unknown>;
  tabs?: Array<{ id: string; label: string; icon?: string }>;
}

export type PluginActionHandler = (
  pluginId: string,
  manager: ImperiaPluginManagerService,
  values?: Record<string, unknown>,
) => ImperiaPluginModule;

const pluginActionRegistry = new Map<string, PluginActionHandler>();

export function registerPluginAction(action: string, handler: PluginActionHandler): void {
  pluginActionRegistry.set(action.toLowerCase(), handler);
}

export function getPluginActionHandler(action: string): PluginActionHandler | undefined {
  return pluginActionRegistry.get(action.toLowerCase());
}

// Register built-in actions
registerPluginAction("install", (id, mgr) => mgr.install(id));
registerPluginAction("enable", (id, mgr) => mgr.enable(id));
registerPluginAction("disable", (id, mgr) => mgr.disable(id));
registerPluginAction("reset", (id, mgr) => mgr.reset(id));
registerPluginAction("uninstall", (id, mgr) => mgr.uninstall(id));
registerPluginAction("configure", (id, mgr, vals) => mgr.configure(id, vals ?? {}));

export class ImperiaPluginManagerService {
  private plugins = new Map<string, ImperiaPluginModule>();

  constructor() {
    this.seedPrestaShopLikeCatalog();
  }

  private seedPrestaShopLikeCatalog(): void {
    this.registerPlugin({
      id: "commerce-comparator",
      name: "Product Comparator",
      author: "MosaiX Core Team",
      version: "1.0.0",
      category: "commerce",
      description: "Permet aux utilisateurs de comparer les caractéristiques de plusieurs vendables.",
      installed: true,
      enabled: true,
      configurable: true,
      configurationValues: { maxCompareItems: 4, displayInHeader: true },
      tabs: [{ id: "comparator-settings", label: "Paramètres du comparateur" }],
    });

    this.registerPlugin({
      id: "commerce-wishlist",
      name: "Customer Wishlist",
      author: "MosaiX Core Team",
      version: "1.2.0",
      category: "commerce",
      description: "Gestion des listes d'envies et favoris clients.",
      installed: true,
      enabled: true,
      configurable: true,
      configurationValues: { allowGuestWishlist: false },
      tabs: [{ id: "wishlist-settings", label: "Configuration Wishlist" }],
    });

    this.registerPlugin({
      id: "commerce-reviews",
      name: "Customer Reviews & Ratings",
      author: "MosaiX Core Team",
      version: "2.0.1",
      category: "commerce",
      description: "Avis clients, modération préalable et étoiles d'évaluation.",
      installed: true,
      enabled: false,
      configurable: true,
      configurationValues: { requireModeration: true, minimumStars: 1 },
      tabs: [{ id: "reviews-moderation", label: "Avis & Modération" }],
    });

    this.registerPlugin({
      id: "security-mfa-authenticator",
      name: "Two-Factor Authenticator (TOTP)",
      author: "MosaiX Security",
      version: "1.1.0",
      category: "security",
      description: "Ajoute la validation 2FA pour les administrateurs et clients.",
      installed: false,
      enabled: false,
      configurable: true,
      configurationValues: { issuerName: "MosaiX Imperia" },
    });
  }

  registerPlugin(plugin: ImperiaPluginModule): void {
    this.plugins.set(plugin.id, plugin);
  }

  listPlugins(category?: PrestaPluginCategory): ImperiaPluginModule[] {
    const engine = getGlobalPluginEngine();
    const runtimePlugins = engine.registry.list();

    // Sync runtime state into catalog
    for (const rp of runtimePlugins) {
      const existing = this.getPlugin(rp.manifest.id);
      if (existing) {
        existing.enabled = rp.state === "ACTIVE";
        existing.installed = rp.state !== "UNLOADED";
      } else {
        this.registerPlugin({
          id: rp.manifest.id,
          name: rp.manifest.name || rp.manifest.id,
          author: rp.manifest.metadata?.author || "Developer",
          version: rp.manifest.version || "1.0.0",
          category: (rp.manifest.extension?.target as PrestaPluginCategory) || "commerce",
          description: rp.manifest.metadata?.description || "Plugin MosaiX",
          installed: rp.state !== "UNLOADED",
          enabled: rp.state === "ACTIVE",
          configurable: Boolean(rp.manifest.settingsSchema),
        });
      }
    }

    const list = Array.from(this.plugins.values());
    if (category) {
      return list.filter((p) => p.category === category);
    }
    return list;
  }

  getPlugin(id: string): ImperiaPluginModule | undefined {
    return this.plugins.get(id);
  }

  install(id: string): ImperiaPluginModule {
    const plugin = this.getPlugin(id);
    if (!plugin) throw new Error(`Module plugin [${id}] non trouvé.`);
    plugin.installed = true;
    plugin.enabled = true;
    const engine = getGlobalPluginEngine();
    if (engine.registry.has(id)) {
      engine.registry.updateState(id, "ACTIVE");
    }
    return plugin;
  }

  enable(id: string): ImperiaPluginModule {
    const plugin = this.getPlugin(id);
    if (!plugin) throw new Error(`Module plugin [${id}] non trouvé.`);
    if (!plugin.installed) throw new Error(`Impossible d'activer un module non installé.`);
    plugin.enabled = true;
    const engine = getGlobalPluginEngine();
    if (engine.registry.has(id)) {
      engine.registry.updateState(id, "ACTIVE");
    }
    return plugin;
  }

  disable(id: string): ImperiaPluginModule {
    const plugin = this.getPlugin(id);
    if (!plugin) throw new Error(`Module plugin [${id}] non trouvé.`);
    plugin.enabled = false;
    const engine = getGlobalPluginEngine();
    if (engine.registry.has(id)) {
      engine.registry.updateState(id, "DISABLED");
    }
    return plugin;
  }

  reset(id: string): ImperiaPluginModule {
    const plugin = this.getPlugin(id);
    if (!plugin) throw new Error(`Module plugin [${id}] non trouvé.`);
    plugin.enabled = true;
    plugin.configurationValues = {};
    return plugin;
  }

  uninstall(id: string): ImperiaPluginModule {
    const plugin = this.getPlugin(id);
    if (!plugin) throw new Error(`Module plugin [${id}] non trouvé.`);
    plugin.installed = false;
    plugin.enabled = false;
    const engine = getGlobalPluginEngine();
    if (engine.registry.has(id)) {
      engine.registry.updateState(id, "DISABLED");
    }
    return plugin;
  }

  configure(id: string, values: Record<string, unknown>): ImperiaPluginModule {
    const plugin = this.getPlugin(id);
    if (!plugin) throw new Error(`Module plugin [${id}] non trouvé.`);
    plugin.configurationValues = { ...plugin.configurationValues, ...values };
    return plugin;
  }
}
