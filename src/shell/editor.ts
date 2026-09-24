import * as fs from "node:fs";
import * as path from "node:path";
import { CompositionOverrideManager } from "@mosaix/core";

export const OVERRIDES_FILE_PATH = path.resolve(process.cwd(), ".mosaix", "composition-overrides.json");

export function saveCompositionOverridesToFile(manager: CompositionOverrideManager, surfaceId: string = "application-shell") {
  try {
    const dir = path.dirname(OVERRIDES_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const store = manager.getStore(surfaceId);
    fs.writeFileSync(OVERRIDES_FILE_PATH, JSON.stringify({ [surfaceId]: store }, null, 2), "utf-8");
  } catch (e) {
    console.error("[MosaiX Runtime] Failed to save composition overrides file:", e);
  }
}

export interface SavedBlockOverride {
  contributionId: string;
  placementId: string;
  order: number;
  gridSpan: number;
  wrapper: string;
  enabled: boolean;
}

export interface SavedSlotOverride {
  blocks: SavedBlockOverride[];
}

export interface SavedStore {
  slotOverrides?: Record<string, SavedSlotOverride>;
}

export function loadCompositionOverridesFromFile(manager: CompositionOverrideManager) {
  try {
    if (fs.existsSync(OVERRIDES_FILE_PATH)) {
      const raw = fs.readFileSync(OVERRIDES_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (const [surfaceId, store] of Object.entries(parsed)) {
          if (store && typeof store === "object") {
            const typedStore = store as SavedStore;
            if (typedStore.slotOverrides) {
              for (const [slotId, slotOverride] of Object.entries(typedStore.slotOverrides)) {
                if (slotOverride && Array.isArray(slotOverride.blocks)) {
                  for (const block of slotOverride.blocks) {
                    manager.setBlockOverride(surfaceId, slotId, block);
                  }
                }
              }
            }
          }
        }
        console.log(`[MosaiX Runtime] Loaded composition overrides from ${OVERRIDES_FILE_PATH}`);
      }
    }
  } catch (e) {
    console.error("[MosaiX Runtime] Failed to load composition overrides file:", e);
  }
}

export const loadSavedCompositionOverrides = loadCompositionOverridesFromFile;


export function renderLiveEditorControlToolbar(slotId: string, blockId: string, currentSpan: number, currentWrapper: string, isLiveEditor: boolean): string {
  if (!isLiveEditor) return "";

  return `
    <div class="mosaix-live-editor-bar bg-surface-container-high/90 backdrop-blur-md border border-primary/40 rounded-t-xl px-3 py-1.5 flex items-center justify-between text-[11px] gap-2 shadow-lg mb-1">
      <div class="flex items-center gap-1.5 font-mono text-primary font-bold">
        <span class="material-symbols-outlined text-xs">drag_indicator</span>
        <span>${blockId}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-on-surface-variant text-[10px]">Span:</span>
        <div class="flex items-center gap-1 bg-surface-container border border-outline-variant/30 rounded px-1">
          <button onclick="updateBlockGridSpan('${slotId}', '${blockId}', ${Math.max(1, currentSpan - 1)})" class="hover:text-primary px-1 font-bold cursor-pointer">-</button>
          <span class="font-bold text-xs text-on-surface px-1">${currentSpan}/12</span>
          <button onclick="updateBlockGridSpan('${slotId}', '${blockId}', ${Math.min(12, currentSpan + 1)})" class="hover:text-primary px-1 font-bold cursor-pointer">+</button>
        </div>

        <span class="text-on-surface-variant text-[10px] ml-1">Wrapper:</span>
        <select onchange="updateBlockWrapper('${slotId}', '${blockId}', this.value)" class="bg-surface-container border border-outline-variant/30 text-on-surface text-[10px] rounded px-1.5 py-0.5 outline-none cursor-pointer">
          <option value="card" ${currentWrapper === 'card' ? 'selected' : ''}>Card</option>
          <option value="glass" ${currentWrapper === 'glass' ? 'selected' : ''}>Glass</option>
          <option value="hero-strip" ${currentWrapper === 'hero-strip' ? 'selected' : ''}>Hero Strip</option>
          <option value="borderless" ${currentWrapper === 'borderless' ? 'selected' : ''}>Borderless</option>
          <option value="panel" ${currentWrapper === 'panel' ? 'selected' : ''}>Panel</option>
        </select>
      </div>
    </div>
  `;
}
