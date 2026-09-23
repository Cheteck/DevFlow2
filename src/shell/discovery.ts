import * as path from "node:path";
import { ApplicationDiscovery } from "@mosaix/core";
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
        return (bacInfo.pageViews[0][1] as { render: () => string }).render();
      }
      return `<div class="p-6 text-center text-red-500">Error: Rendering component missing for ${name}</div>`;
    };

    const isInComposition = CompositionManager.isAppActiveInComposition(id);

    return {
      id,
      name,
      description: m.description || "Module connecté au réseau MosaiX.",
      category: "Modules",
      route: prefix,
      icon: APP_ICONS[cleanId] || APP_ICONS[id] || "🚀",
      renderView: render,
      featureFlag: `apps.${cleanId}.enabled`,
      inComposition: isInComposition
    };
  });
}

export const apps = discoverApps();
