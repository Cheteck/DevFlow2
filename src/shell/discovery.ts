import * as path from "node:path";
import { ApplicationDiscovery, shellRegistry } from "@mosaix/core";
import type { ApplicationManifest } from "@mosaix/contracts";
import { escapeHtml } from "@mosaix/support";
import { DynamicBacRegistry } from "./dynamic-bac-registry.js";
import { CompositionManager } from "./composition-loader.js";

/** Fallback when a manifest carries no usable icon (logged, never silent). */
export const FALLBACK_BAC_ICON = "📦";

export type BacIconKind = "emoji" | "material" | "image";

export interface ParsedBacIcon {
  kind: BacIconKind;
  /** Emoji grapheme, Material Symbol name, or image URL/path (raw). */
  value: string;
}

const MATERIAL_SYMBOL_NAME = /^[a-z0-9_]+$/;
const IMAGE_EXTENSIONS = [".ico", ".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif"];

/**
 * Typed icon parsing (single source of truth for the icon mini-syntax).
 * Returns null when the value is not a supported icon — callers fall back
 * to {@link FALLBACK_BAC_ICON}. `javascript:`/`data:`/whitespace payloads
 * are rejected here, so renderers can interpolate without re-validating.
 */
export function parseBacIcon(raw: unknown): ParsedBacIcon | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (value.length === 0 || /\s/.test(value)) return null;

  const material = /^material:(.+)$/i.exec(value);
  if (material) {
    const name = material[1].trim().toLowerCase();
    return MATERIAL_SYMBOL_NAME.test(name) ? { kind: "material", value: name } : null;
  }

  const lower = value.toLowerCase();
  const isRelative = value.startsWith("/") || value.startsWith("./") || value.startsWith("../");
  const isRemote = lower.startsWith("https://") || lower.startsWith("http://");
  if ((isRelative || isRemote) && IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return { kind: "image", value };
  }

  // Bare emoji grapheme (current design language).
  return value.length <= 8 ? { kind: "emoji", value } : null;
}

/**
 * Safe icon HTML for any manifest icon value. Unknown/unsafe values render
 * the fallback — output is always escaped, including image URLs.
 */
export function renderBacIcon(icon: string, fallback = FALLBACK_BAC_ICON): string {
  const parsed = parseBacIcon(icon) ?? parseBacIcon(fallback);
  if (!parsed) return escapeHtml(fallback);
  if (parsed.kind === "material") {
    return `<span class="material-symbols-outlined" aria-hidden="true">${escapeHtml(parsed.value)}</span>`;
  }
  if (parsed.kind === "image") {
    return `<img src="${escapeHtml(parsed.value)}" alt="" loading="lazy" aria-hidden="true" style="width:1.25em;height:1.25em;object-fit:contain;" />`;
  }
  return escapeHtml(parsed.value);
}

/**
 * Manifest-driven icon resolution (single source of truth:
 * `experience.appCard.icon`, BAC-owned). Invalid values warn and fall back —
 * see {@link parseBacIcon} for the supported syntax.
 */
export function resolveManifestIcon(
  manifest: ApplicationManifest,
  warn: (message: string) => void = console.warn,
): string {
  const raw = manifest.experience?.appCard?.icon;
  const parsed = parseBacIcon(raw);
  if (parsed) {
    // Store the canonical value (trimmed/lowercased material name).
    return parsed.kind === "emoji" || parsed.kind === "image"
      ? (raw as string).trim()
      : `material:${parsed.value}`;
  }
  warn(
    `[discovery] BAC "${manifest.id}" has no valid experience.appCard.icon — using fallback ${FALLBACK_BAC_ICON}.`,
  );
  return FALLBACK_BAC_ICON;
}

export function isBacVisibleInNavigation(manifest: ApplicationManifest): boolean {
  return manifest.experience?.appCard?.showInNavigation !== false;
}

function seedShellNavigation(): void {
  for (const manifest of ApplicationDiscovery.discoverWorkspaceApps(
    path.resolve(process.cwd(), "apps"),
  )) {
    if (!isBacVisibleInNavigation(manifest)) continue;
    const cleanId = manifest.id.replace(/^@apps\//, "");
    shellRegistry.registerNavigationItem({
      bacId: manifest.id,
      label: manifest.experience?.appCard?.title || cleanId.charAt(0).toUpperCase() + cleanId.slice(1),
      icon: resolveManifestIcon(manifest),
      route: `/${cleanId}`,
    });
  }
}

// Seed shellRegistry once at import (same lifecycle as the previous map).
seedShellNavigation();

export function discoverApps() {
  const appsDir = path.resolve(process.cwd(), "apps");
  const manifests = ApplicationDiscovery.discoverWorkspaceApps(appsDir);
  return manifests.map(m => {
    const id = m.id;
    const cleanId = id.replace(/^@apps\//, "");
    const name = m.name || cleanId.charAt(0).toUpperCase() + cleanId.slice(1);
    const routes = m.routes;
    const prefix =
      routes && !Array.isArray(routes) && routes.prefix ? routes.prefix : `/${cleanId}`;
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
            ${shellRegistry.getIconForBac(cleanId, FALLBACK_BAC_ICON)}
          </div>
          <div>
            <h2 class="text-xl font-bold text-on-surface">${name}</h2>
            <p class="text-sm text-on-surface-variant mt-1">${m.metadata?.description || "Module connecté et enregistré dans le registre décentralisé MosaiX."}</p>
          </div>
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Statut : Prêt & Découvert
          </div>
        </div>
      `;
    };

    const isInComposition = CompositionManager.isAppActiveInComposition(id);
    const icon = shellRegistry.getIconForBac(cleanId, FALLBACK_BAC_ICON);

    return {
      id,
      name,
      description: m.metadata?.description || "Module connecté au réseau MosaiX.",
      category: "Modules",
      route: prefix,
      icon,
      // Manifest-driven visibility (engine BACs hide without shell hardcode).
      navigable: isBacVisibleInNavigation(m),
      renderView: render,
      featureFlag: `apps.${cleanId}.enabled`,
      inComposition: isInComposition
    };
  });
}

export const apps = discoverApps();
