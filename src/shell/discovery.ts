import * as path from "node:path";
import { ApplicationDiscovery, shellRegistry } from "@mosaix/core";
import { DynamicBacRegistry } from "./dynamic-bac-registry.js";
import { CompositionManager } from "./composition-loader.js";

export const APP_ICONS: Record<string, string> = {
  identity: "👤",
  citadelle: "🛡️",
  solara: "☀️",
  solidarity: "🤝",
  imperia: "🏛️",
  spaces: "📁",
  commerce: "🛒",
  beam: "💬",
  portfolio: "🎨",
  booking: "📅",
  subscription: "💳"
};

// Seed shellRegistry with standard navigation icons
for (const [key, icon] of Object.entries(APP_ICONS)) {
  if (key === "subscription") continue; // Exclude engine from main navigation
  shellRegistry.registerNavigationItem({
    bacId: key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    icon,
    route: `/${key}`,
  });
}

export function discoverApps() {
  const appsDir = path.resolve(process.cwd(), "apps");
  const manifests = ApplicationDiscovery.discoverWorkspaceApps(appsDir);
  return manifests.map(m => {
    const id = m.id;
    const cleanId = id.replace(/^@apps\//, "");
    const name = m.name || cleanId.charAt(0).toUpperCase() + cleanId.slice(1);
    const prefix = m.routes?.prefix || `/${cleanId}`;
    const bacInfo = DynamicBacRegistry.get(cleanId);
    
    const render = (targetPath?: string) => {
      if (bacInfo && bacInfo.pageViews && bacInfo.pageViews.length > 0) {
        if (targetPath) {
          const subKey = targetPath.replace(new RegExp(`^${prefix}/?`), "").toLowerCase();
          const matchedView = bacInfo.pageViews.find(([key]) => key.toLowerCase() === subKey);
          if (matchedView && matchedView[1] && typeof (matchedView[1] as { render?: () => string }).render === "function") {
            return (matchedView[1] as { render: () => string }).render();
          }
        }
        if (bacInfo.pageViews[0][1] && typeof (bacInfo.pageViews[0][1] as { render?: () => string }).render === "function") {
          return (bacInfo.pageViews[0][1] as { render: () => string }).render();
        }
      }
      return `
        <div class="p-8 text-center space-y-4">
          <div class="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-3xl mx-auto shadow-inner">
            ${shellRegistry.getIconForBac(cleanId, APP_ICONS[cleanId] || "📦")}
          </div>
          <div>
            <h2 class="text-xl font-bold text-on-surface">${name}</h2>
            <p class="text-sm text-on-surface-variant mt-1">${m.description || "Module connecté et enregistré dans le registre décentralisé MosaiX."}</p>
          </div>
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Statut : Prêt & Découvert
          </div>
        </div>
      `;
    };

    const isInComposition = CompositionManager.isAppActiveInComposition(id);
    const icon = shellRegistry.getIconForBac(cleanId, APP_ICONS[cleanId] || APP_ICONS[id] || "🚀");

    return {
      id,
      name,
      description: m.description || "Module connecté au réseau MosaiX.",
      category: "Modules",
      route: prefix,
      icon,
      renderView: render,
      featureFlag: `apps.${cleanId}.enabled`,
      inComposition: isInComposition
    };
  });
}

export const apps = discoverApps();
