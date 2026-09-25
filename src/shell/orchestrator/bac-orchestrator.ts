/**
 * @mosaix/shell — BAC Orchestrator & Dynamic Runtime Dispatcher
 * Discovers, validates, resolves, and renders BACs adhering to BacDescriptor contracts.
 * Decouples the Shell completely from specific applications (like Solara, Commerce, or Citadelle).
 */

import type {
  BacDescriptor,
  BacExecutionContext,
  BacRenderResult,
  PlatformSettings,
} from "@mosaix/contracts";
import { escapeHtml } from "@mosaix/support";
import { apps } from "../discovery.js";
import { DynamicBacRegistry } from "../dynamic-bac-registry.js";

export class BacOrchestrator {
  private descriptors = new Map<string, BacDescriptor>();
  private dynamicLoaders = new Map<string, () => Promise<BacDescriptor>>();

  constructor() {
    this.registerDiscoveredWorkspaceApps();
    this.registerBuiltinDynamicLoaders();
  }

  registerDynamicLoader(id: string, loader: () => Promise<BacDescriptor>): void {
    const cleanId = id.replace(/^@apps\//, "");
    this.dynamicLoaders.set(cleanId, loader);
    this.dynamicLoaders.set(id, loader);
  }

  private registerBuiltinDynamicLoaders(): void {
    // Solara dynamic descriptor loader
    this.registerDynamicLoader("solara", async () => {
      const { createSolaraDescriptor } = await import("../../../apps/solara/src/presentation/solara-view.js");
      return createSolaraDescriptor();
    });

    // Booking dynamic descriptor loader
    this.registerDynamicLoader("booking", async () => {
      const { createBookingDescriptor } = await import("../../../apps/booking/src/presentation/booking-view.js");
      return createBookingDescriptor();
    });

    // Beam dynamic descriptor loader
    this.registerDynamicLoader("beam", async () => {
      const { createBeamDescriptor } = await import("../../../apps/beam/src/presentation/beam-view.js");
      return createBeamDescriptor();
    });

    // Commerce dynamic descriptor loader
    this.registerDynamicLoader("commerce", async () => {
      const { createCommerceDescriptor } = await import("../../../apps/commerce/src/presentation/commerce-view.js");
      return createCommerceDescriptor();
    });

    // Portfolio dynamic descriptor loader
    this.registerDynamicLoader("portfolio", async () => {
      const { createPortfolioDescriptor } = await import("../../../apps/portfolio/src/presentation/portfolio-view.js");
      return createPortfolioDescriptor();
    });

    // Citadelle (Identity) dynamic descriptor loader
    this.registerDynamicLoader("citadelle", async () => {
      const { createCitadelleDescriptor } = await import("../../../apps/citadelle/src/presentation/citadelle-view.js");
      return createCitadelleDescriptor();
    });
    this.registerDynamicLoader("identity", async () => {
      const { createCitadelleDescriptor } = await import("../../../apps/citadelle/src/presentation/citadelle-view.js");
      return createCitadelleDescriptor();
    });

    // Spaces dynamic descriptor loader
    this.registerDynamicLoader("spaces", async () => {
      const { createSpacesDescriptor } = await import("../../../apps/spaces/src/presentation/spaces-view.js");
      return createSpacesDescriptor();
    });

    // Solidarity dynamic descriptor loader
    this.registerDynamicLoader("solidarity", async () => {
      const { createSolidarityDescriptor } = await import("../../../apps/solidarity/src/presentation/solidarity-view.js");
      return createSolidarityDescriptor();
    });

    // Imperia dynamic descriptor loader
    this.registerDynamicLoader("imperia", async () => {
      const { createImperiaDescriptor } = await import("../../../apps/imperia/src/presentation/imperia-view.js");
      return createImperiaDescriptor();
    });

    // Subscription dynamic descriptor loader
    this.registerDynamicLoader("subscription", async () => {
      const { createSubscriptionDescriptor } = await import("../../../apps/subscription/src/presentation/subscription-view.js");
      return createSubscriptionDescriptor();
    });
  }

  async loadDescriptor(id: string): Promise<BacDescriptor | undefined> {
    const cleanId = id.replace(/^@apps\//, "");
    if (this.descriptors.has(cleanId)) {
      return this.descriptors.get(cleanId);
    }
    if (this.dynamicLoaders.has(cleanId)) {
      try {
        const desc = await this.dynamicLoaders.get(cleanId)!();
        this.register(desc);
        return desc;
      } catch (err) {
        console.warn(`[BacOrchestrator] Could not load dynamic descriptor for [${cleanId}]:`, err);
      }
    }
    return undefined;
  }

  /**
   * Registers a BAC descriptor into the orchestrator
   */
  register(descriptor: BacDescriptor): void {
    const cleanId = descriptor.id.replace(/^@apps\//, "");
    this.descriptors.set(cleanId, descriptor);
    this.descriptors.set(descriptor.id, descriptor);
  }

  /**
   * Retrieves a registered descriptor by clean or full ID
   */
  getDescriptor(bacId: string): BacDescriptor | undefined {
    const cleanId = bacId.replace(/^@apps\//, "");
    return this.descriptors.get(cleanId) || this.descriptors.get(bacId);
  }

  /**
   * Lists all registered BAC descriptors
   */
  listDescriptors(): BacDescriptor[] {
    const unique = new Map<string, BacDescriptor>();
    for (const [key, desc] of this.descriptors.entries()) {
      if (!key.startsWith("@apps/")) {
        unique.set(desc.id, desc);
      }
    }
    return Array.from(unique.values());
  }

  /**
   * Resolves which BAC to mount for the root '/' route based on:
   * 1. Platform Settings (defaultBacId)
   * 2. BAC operational readiness & enabled state
   * 3. User authorization (allowedBacs)
   * 4. Platform fallback (fallbackBacId)
   */
  async resolveDefaultBac(
    settings: PlatformSettings,
    userAllowedBacs: string[]
  ): Promise<{ descriptor: BacDescriptor; isFallback: boolean } | null> {
    const targetId = settings.defaultBacId || "solara";
    const cleanTargetId = targetId.replace(/^@apps\//, "");

    // 1. Check if user is allowed to access target BAC
    const isTargetAllowed =
      userAllowedBacs.includes("*") ||
      userAllowedBacs.includes(targetId) ||
      userAllowedBacs.includes(cleanTargetId);

    if (isTargetAllowed) {
      const descriptor = (await this.loadDescriptor(targetId)) || this.getDescriptor(targetId);
      if (descriptor && descriptor.isEnabled && (await descriptor.isAvailable())) {
        return { descriptor, isFallback: false };
      }
    }

    // 2. Target BAC not available or unauthorized -> attempt configured fallback
    if (settings.fallbackBacId) {
      const fallbackId = settings.fallbackBacId;
      const cleanFallbackId = fallbackId.replace(/^@apps\//, "");
      const isFallbackAllowed =
        userAllowedBacs.includes("*") ||
        userAllowedBacs.includes(fallbackId) ||
        userAllowedBacs.includes(cleanFallbackId);

      if (isFallbackAllowed) {
        const fallbackDesc = (await this.loadDescriptor(fallbackId)) || this.getDescriptor(fallbackId);
        if (fallbackDesc && fallbackDesc.isEnabled && (await fallbackDesc.isAvailable())) {
          return { descriptor: fallbackDesc, isFallback: true };
        }
      }
    }

    // 3. Fallback to first available authorized BAC
    for (const allowed of userAllowedBacs) {
      if (allowed === "*") continue;
      const desc = (await this.loadDescriptor(allowed)) || this.getDescriptor(allowed);
      if (desc && desc.isEnabled && (await desc.isAvailable())) {
        return { descriptor: desc, isFallback: true };
      }
    }

    return null;
  }

  /**
   * Executes render pass for a specific BAC
   */
  async renderBac(bacId: string, context: BacExecutionContext): Promise<BacRenderResult> {
    const descriptor = this.getDescriptor(bacId);
    if (!descriptor) {
      return {
        contentHtml: `
          <div class="glass-card p-8 rounded-2xl max-w-xl mx-auto my-12 text-center space-y-4 border border-rose-500/30">
            <div class="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center text-2xl mx-auto">
              error
            </div>
            <h2 class="text-xl font-bold text-on-surface">Application Introuvable</h2>
            <p class="text-sm text-on-surface-variant">Le module [${escapeHtml(bacId)}] n'est pas enregistré dans le registre décentralisé du Shell.</p>
          </div>
        `,
        pageTitle: "Module Introuvable",
      };
    }

    try {
      return await descriptor.render(context);
    } catch (err) {
      return this.renderBacErrorBoundary(descriptor, err);
    }
  }

  /**
   * Isolates BAC execution failures and renders a safe, accessible error card
   */
  private renderBacErrorBoundary(descriptor: BacDescriptor, error: unknown): BacRenderResult {
    const message = error instanceof Error ? error.message : String(error);
    return {
      contentHtml: `
        <div class="glass-card p-8 rounded-2xl max-w-2xl mx-auto my-12 text-center space-y-4 border border-amber-500/30 bg-surface-container-high/40">
          <div class="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-3xl mx-auto">
            warning
          </div>
          <div>
            <h2 class="text-xl font-bold text-on-surface">Erreur d'Exécution du Module ${escapeHtml(descriptor.name)}</h2>
            <p class="text-sm text-on-surface-variant mt-1">Le composant applicatif a rencontré une interruption inattendue.</p>
          </div>
          <div class="p-3 rounded-xl bg-surface-container-lowest font-mono text-xs text-rose-400 text-left overflow-x-auto max-h-48 border border-outline-variant/20">
            ${escapeHtml(message)}
          </div>
          <div class="pt-2">
            <button onclick="window.location.reload()" class="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:opacity-90 transition cursor-pointer">
              Réessayer le chargement
            </button>
          </div>
        </div>
      `,
      pageTitle: `Erreur — ${descriptor.name}`,
    };
  }

  /**
   * Adapts existing discovered workspace apps into the new BacDescriptor contract
   */
  private registerDiscoveredWorkspaceApps(): void {
    for (const app of apps) {
      const cleanId = app.id.replace(/^@apps\//, "");
      const descriptor: BacDescriptor = {
        id: app.id,
        name: app.name,
        version: "1.0.0",
        routePrefix: app.route,
        icon: app.icon,
        isEnabled: true,
        isAvailable: async () => true,
        render: async (context: BacExecutionContext) => {
          // Check if dynamic page views or custom views are registered
          const bacInfo = DynamicBacRegistry.get(cleanId);
          if (bacInfo && bacInfo.pageViews && bacInfo.pageViews.length > 0) {
            const firstView = bacInfo.pageViews[0][1];
            if (firstView && typeof (firstView as { render?: () => string }).render === "function") {
              return {
                contentHtml: (firstView as { render: () => string }).render(),
                pageTitle: app.name,
              };
            }
          }

          // If app has its own render function (from discovery.ts)
          if (typeof app.renderView === "function") {
            const rendered = app.renderView(context.request.path);
            return {
              contentHtml: rendered,
              pageTitle: app.name,
            };
          }

          return {
            contentHtml: `
              <div class="p-8 text-center space-y-3">
                <span class="text-4xl">${app.icon}</span>
                <h2 class="text-xl font-bold text-on-surface">${escapeHtml(app.name)}</h2>
                <p class="text-sm text-on-surface-variant">${escapeHtml(app.description)}</p>
              </div>
            `,
            pageTitle: app.name,
          };
        },
      };

      this.register(descriptor);
    }
  }
}

export const bacOrchestrator = new BacOrchestrator();
