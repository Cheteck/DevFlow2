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
    return plugin;
  }

  enable(id: string): ImperiaPluginModule {
    const plugin = this.getPlugin(id);
    if (!plugin) throw new Error(`Module plugin [${id}] non trouvé.`);
    if (!plugin.installed) throw new Error(`Impossible d'activer un module non installé.`);
    plugin.enabled = true;
    return plugin;
  }

  disable(id: string): ImperiaPluginModule {
    const plugin = this.getPlugin(id);
    if (!plugin) throw new Error(`Module plugin [${id}] non trouvé.`);
    plugin.enabled = false;
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
    return plugin;
  }

  configure(id: string, values: Record<string, unknown>): ImperiaPluginModule {
    const plugin = this.getPlugin(id);
    if (!plugin) throw new Error(`Module plugin [${id}] non trouvé.`);
    plugin.configurationValues = { ...plugin.configurationValues, ...values };
    return plugin;
  }
}
