/**
 * @mosaix/ui-runtime — Unified Experience Composition and UI Slot Registry
 */

import { qrCodeGeneratorPlugin } from "./plugins/qr-code-generator.plugin.js";
import { formHelpSidebarPlugin } from "./plugins/form-help-sidebar.plugin.js";

export interface UISlotContribution {
  slot: string;
  applicationId: string;
  entrypoint: string;
  order?: number;
  permission?: string;
  renderer?: (context?: unknown) => string;
  [key: string]: unknown;
}

export class SlotRegistry {
  private contributions: UISlotContribution[] = [];

  register(contribution: UISlotContribution): void {
    this.contributions.push(contribution);
  }

  getSlotContributions(slotId: string): UISlotContribution[] {
    return this.contributions
      .filter((c) => c.slot === slotId)
      .sort((a, b) => (a.order ?? 10) - (b.order ?? 10));
  }

  renderSlot(slotId: string, context?: unknown): string {
    return this.getSlotContributions(slotId)
      .map((c) => {
        if (typeof c.renderer === "function") {
          return c.renderer(context);
        }
        return "";
      })
      .join("\n");
  }

  clear(): void {
    this.contributions = [];
  }
}

export const slotRegistry = new SlotRegistry();

// Auto-register built-in UI plugins to standard slots
slotRegistry.register({
  slot: "portfolio.vendable.share",
  applicationId: "qr-code-plugin",
  entrypoint: "./plugins/qr-code-generator.plugin.js",
  order: 20,
  renderer: (ctx) => {
    const url = typeof ctx === "string" ? ctx : (ctx as { url?: string })?.url || "https://mosaix.local";
    return qrCodeGeneratorPlugin.renderQrCard("Partager par QR Code", url);
  },
});

slotRegistry.register({
  slot: "form.wizard.help",
  applicationId: "form-help-plugin",
  entrypoint: "./plugins/form-help-sidebar.plugin.js",
  order: 10,
  renderer: (ctx) => {
    const step = typeof ctx === "string" ? ctx : (ctx as { step?: string })?.step || "general";
    return formHelpSidebarPlugin.renderHelpPanel(step);
  },
});

export * from "./plugins/form-help-sidebar.plugin.js";
export * from "./plugins/qr-code-generator.plugin.js";
