import { identityContributions, IdentityLoginPageView, IdentityRegisterPageView, IdentityGdprPrivacyPageView } from "../../apps/citadelle/frontend/src/index.js";
import { solaraContributions, SolaraSocialFeedPageView } from "../../apps/solara/frontend/src/index.js";
import { solidarityContributions, SolidarityPageView } from "../../apps/solidarity/frontend/src/index.js";
import { imperiaContributions, ImperiaGovernancePageView } from "../../apps/imperia/frontend/src/index.js";
import { spacesContributions, SpaceDashboardPageView } from "../../apps/spaces/frontend/src/index.js";
import { commerceContributions, CommerceCheckoutPageView } from "../../apps/commerce/frontend/src/index.js";
import { beamContributions, BeamConversationPageView } from "../../apps/beam/frontend/src/index.js";
import { portfolioContributions, PortfolioCatalogPageView } from "../../apps/portfolio/frontend/src/index.js";
import { bookingContributions, BookingPageView } from "../../apps/booking/frontend/src/index.js";
import { subscriptionContributions, SubscriptionPageView } from "../../apps/subscription/frontend/src/index.js";

export interface BacPluginRegistration {
  id: string;
  contributions: unknown[];
  pageViews: Array<[string, unknown]>;
  dynamicLoader?: () => Promise<unknown>;
}

export type DynamicModuleLoader = () => Promise<{
  contributions?: unknown[];
  pageViews?: Array<[string, unknown]>;
  [key: string]: unknown;
}>;

export class DynamicBacRegistry {
  private static registry = new Map<string, BacPluginRegistration>();
  private static dynamicLoaders = new Map<string, DynamicModuleLoader>();
  private static listeners = new Set<(plugin: BacPluginRegistration) => void>();

  static {
    // Register canonical core modules
    this.register({
      id: "citadelle",
      contributions: identityContributions || [],
      pageViews: [
        ["login", IdentityLoginPageView],
        ["register", IdentityRegisterPageView],
        ["privacy", IdentityGdprPrivacyPageView],
      ],
    });
    this.register({
      id: "solara",
      contributions: solaraContributions || [],
      pageViews: [["feed", SolaraSocialFeedPageView]],
    });
    this.register({
      id: "solidarity",
      contributions: solidarityContributions || [],
      pageViews: [["solidarity", SolidarityPageView]],
    });
    this.register({
      id: "imperia",
      contributions: imperiaContributions || [],
      pageViews: [["governance", ImperiaGovernancePageView]],
    });
    this.register({
      id: "spaces",
      contributions: spacesContributions || [],
      pageViews: [["spaces", SpaceDashboardPageView]],
    });
    this.register({
      id: "commerce",
      contributions: commerceContributions || [],
      pageViews: [["checkout", CommerceCheckoutPageView]],
    });
    this.register({
      id: "beam",
      contributions: beamContributions || [],
      pageViews: [["chat", BeamConversationPageView]],
    });
    this.register({
      id: "portfolio",
      contributions: portfolioContributions || [],
      pageViews: [["catalog", PortfolioCatalogPageView]],
    });
    this.register({
      id: "booking",
      contributions: bookingContributions || [],
      pageViews: [["main", BookingPageView]],
    });
    this.register({
      id: "subscription",
      contributions: subscriptionContributions || [],
      pageViews: [["main", SubscriptionPageView]],
    });
  }

  static register(plugin: BacPluginRegistration): void {
    const cleanId = plugin.id.replace(/^@apps\//, "");
    this.registry.set(cleanId, plugin);
    this.registry.set(plugin.id, plugin);

    for (const listener of this.listeners) {
      try {
        listener(plugin);
      } catch (err) {
        console.error(`[DynamicBacRegistry] Listener error on plugin ${plugin.id}:`, err);
      }
    }
  }

  static registerDynamicLoader(id: string, loader: DynamicModuleLoader): void {
    const cleanId = id.replace(/^@apps\//, "");
    this.dynamicLoaders.set(cleanId, loader);
    this.dynamicLoaders.set(id, loader);
  }

  static async loadDynamicModule(id: string): Promise<BacPluginRegistration | undefined> {
    const cleanId = id.replace(/^@apps\//, "");
    const existing = this.get(cleanId);
    if (existing) return existing;

    const loader = this.dynamicLoaders.get(cleanId);
    if (!loader) return undefined;

    try {
      const moduleExport = await loader();
      const registration: BacPluginRegistration = {
        id: cleanId,
        contributions: moduleExport.contributions || [],
        pageViews: moduleExport.pageViews || [],
      };
      this.register(registration);
      return registration;
    } catch (err) {
      console.error(`[DynamicBacRegistry] Failed to load dynamic module [${id}]:`, err);
      return undefined;
    }
  }

  static get(id: string): BacPluginRegistration | undefined {
    const cleanId = id.replace(/^@apps\//, "");
    return this.registry.get(cleanId) || this.registry.get(id);
  }

  static has(id: string): boolean {
    const cleanId = id.replace(/^@apps\//, "");
    return this.registry.has(cleanId) || this.dynamicLoaders.has(cleanId);
  }

  static getAll(): BacPluginRegistration[] {
    return Array.from(new Set(this.registry.values()));
  }

  static getAllContributions(): unknown[] {
    return this.getAll().flatMap((b) => b.contributions);
  }

  static onPluginRegistered(listener: (plugin: BacPluginRegistration) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

// Export backward-compatible array for seamless transition
export const bacRegistry = DynamicBacRegistry.getAll();
