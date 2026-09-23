import * as fs from "node:fs";
import * as path from "node:path";
import { MemoryFeatureFlagsAdapter } from "@mosaix/adapter-featureflags-memory";
import type { FeatureFlagDefinition, FeatureFlagUserContext } from "@mosaix/ports-feature-flags";
import { registerFeatureFlagsProvider } from "@mosaix/sdk";

const FEATURE_FLAGS_FILE = path.resolve(process.cwd(), ".mosaix/feature-flags.json");

/**
 * Standard platform feature flag catalog with domain tags and descriptions
 */
export const DEFAULT_PLATFORM_FLAGS: Record<
  string,
  {
    value: boolean | string;
    description: string;
    category: string;
    variationType: "boolean" | "string";
    rolesAllowlist?: string[];
    usersAllowlist?: string[];
    tenantsAllowlist?: string[];
    plansAllowlist?: string[];
    percentageRollout?: number;
  }
> = {
  // Platform & Core
  "platform.mcp.gateway_enabled": {
    value: true,
    description: "Active la passerelle MCP pour les intégrations et les outils agents.",
    category: "platform",
    variationType: "boolean",
  },
  "platform.live_editor.enabled": {
    value: true,
    description: "Active la barre d'édition de grille et la customisation en direct de l'UI.",
    category: "platform",
    variationType: "boolean",
    rolesAllowlist: ["admin", "super-admin"],
  },
  "platform.experimental_plugins": {
    value: false,
    description: "Active le chargement des extensions communautaires non certifiées.",
    category: "platform",
    variationType: "boolean",
    rolesAllowlist: ["admin"],
  },

  // BAC Apps Visibility & Gates
  "apps.citadelle.enabled": {
    value: true,
    description: "Active le module Citadelle (Sécurité, IAM, Audit & Profils).",
    category: "apps",
    variationType: "boolean",
  },
  "apps.solara.enabled": {
    value: true,
    description: "Active le module Solara (Réseau social, Flux d'actualité & Publications).",
    category: "apps",
    variationType: "boolean",
  },
  "apps.beam.enabled": {
    value: true,
    description: "Active le module Beam (Messagerie directe, canaux d'équipe & chat).",
    category: "apps",
    variationType: "boolean",
  },
  "apps.commerce.enabled": {
    value: true,
    description: "Active le module Commerce (Boutique en ligne, paniers & checkout).",
    category: "apps",
    variationType: "boolean",
  },
  "apps.portfolio.enabled": {
    value: true,
    description: "Active le module Portfolio (Vitrine des réalisations & galeries).",
    category: "apps",
    variationType: "boolean",
  },
  "apps.spaces.enabled": {
    value: true,
    description: "Active le module Espaces (Gestion des espaces collectifs & contextes).",
    category: "apps",
    variationType: "boolean",
  },
  "apps.solidarity.enabled": {
    value: true,
    description: "Active le module Solidarité (Collecte, entraide & distribution).",
    category: "apps",
    variationType: "boolean",
  },
  "apps.imperia.enabled": {
    value: true,
    description: "Active le module Imperia (Console de gouvernance & supervision).",
    category: "apps",
    variationType: "boolean",
    rolesAllowlist: ["admin", "platform-governor"],
  },

  // Functional Sub-features
  "beam.messaging.group_chats": {
    value: true,
    description: "Permet la création de conversations de groupe à plusieurs membres dans Beam.",
    category: "beam",
    variationType: "boolean",
  },
  "solara.posts.showcase_type": {
    value: true,
    description: "Active les publications de type Showcase / Produit dans le fil Solara.",
    category: "solara",
    variationType: "boolean",
  },
  "solara.comments.reactions": {
    value: true,
    description: "Permet les réactions émotionnelles en direct sur les publications.",
    category: "solara",
    variationType: "boolean",
  },
  "commerce.checkout.guest_mode": {
    value: false,
    description: "Permet de finaliser une commande sans compte utilisateur Citadelle.",
    category: "commerce",
    variationType: "boolean",
  },
  "spaces.multi_tenancy.cross_space_sharing": {
    value: true,
    description: "Autorise le partage de documents et flux entre différents espaces abonnés.",
    category: "spaces",
    variationType: "boolean",
  },
};

export class PersistentFeatureFlagsManager {
  private readonly adapter: MemoryFeatureFlagsAdapter;
  private readonly flagMetadata = new Map<string, {
    rolesAllowlist?: string[];
    usersAllowlist?: string[];
    tenantsAllowlist?: string[];
    plansAllowlist?: string[];
    percentageRollout?: number;
  }>();

  constructor() {
    this.adapter = new MemoryFeatureFlagsAdapter();
    this.init();
  }

  private init() {
    // 1. Load initial default catalog
    for (const [key, meta] of Object.entries(DEFAULT_PLATFORM_FLAGS)) {
      this.adapter.setFlag(key, meta.value, meta.description, {
        category: meta.category,
        rolesAllowlist: meta.rolesAllowlist,
      });
      this.flagMetadata.set(key, {
        rolesAllowlist: meta.rolesAllowlist,
        usersAllowlist: meta.usersAllowlist,
        tenantsAllowlist: meta.tenantsAllowlist,
        plansAllowlist: meta.plansAllowlist,
        percentageRollout: meta.percentageRollout,
      });
    }

    // 2. Load disk overrides if existing
    try {
      if (fs.existsSync(FEATURE_FLAGS_FILE)) {
        const raw = fs.readFileSync(FEATURE_FLAGS_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null) {
          for (const [key, flagRecord] of Object.entries(parsed)) {
            const record = flagRecord as { value?: boolean | string; description?: string; rolesAllowlist?: string[]; usersAllowlist?: string[]; tenantsAllowlist?: string[]; plansAllowlist?: string[]; percentageRollout?: number };
            const val = record?.value !== undefined ? record.value : flagRecord;
            if (val !== undefined) {
              const desc = record?.description;
              this.adapter.setFlag(key, val as boolean | string, desc);
              if (typeof flagRecord === "object" && flagRecord !== null) {
                this.flagMetadata.set(key, {
                  rolesAllowlist: record.rolesAllowlist,
                  usersAllowlist: record.usersAllowlist,
                  tenantsAllowlist: record.tenantsAllowlist,
                  plansAllowlist: record.plansAllowlist,
                  percentageRollout: record.percentageRollout,
                });
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("[FeatureFlags] Failed to read .mosaix/feature-flags.json:", e);
    }

    // 3. Register as global SDK provider
    registerFeatureFlagsProvider(this.adapter);
  }

  public getAdapter(): MemoryFeatureFlagsAdapter {
    return this.adapter;
  }

  public async isEnabled(key: string, context?: FeatureFlagUserContext, defaultValue = false): Promise<boolean> {
    const baseResult = await this.adapter.isEnabled(key, context, defaultValue);
    if (!baseResult) return false;

    // Granular rules evaluation
    const meta = this.flagMetadata.get(key);
    if (!meta || !context) return true;

    // 1. Users allowlist
    if (meta.usersAllowlist && meta.usersAllowlist.length > 0) {
      if (context.userId && meta.usersAllowlist.includes(context.userId)) {
        return true;
      }
      return false; // If users allowlist is set and user not in it
    }

    // 2. Roles allowlist
    if (meta.rolesAllowlist && meta.rolesAllowlist.length > 0) {
      if (context.roles && context.roles.some(r => meta.rolesAllowlist!.includes(r))) {
        return true;
      }
      return false;
    }

    // 3. Tenants allowlist
    if (meta.tenantsAllowlist && meta.tenantsAllowlist.length > 0) {
      if (context.tenantId && meta.tenantsAllowlist.includes(context.tenantId)) {
        return true;
      }
      return false;
    }

    // 4. Subscription Plans allowlist
    if (meta.plansAllowlist && meta.plansAllowlist.length > 0) {
      const userPlan = (context as unknown as { subscriptionPlan?: string }).subscriptionPlan || (context.custom?.subscriptionPlan as string);
      if (userPlan && meta.plansAllowlist.includes(userPlan)) {
        return true;
      }
      return false;
    }

    // 5. Percentage Rollout
    if (typeof meta.percentageRollout === "number" && meta.percentageRollout >= 0 && meta.percentageRollout < 100) {
      if (context.userId) {
        let hash = 0;
        for (let i = 0; i < context.userId.length; i++) {
          hash = (hash << 5) - hash + context.userId.charCodeAt(i);
          hash |= 0;
        }
        const userPercent = Math.abs(hash) % 100;
        return userPercent < meta.percentageRollout;
      }
      return false;
    }

    return true;
  }

  public isEnabledSync(key: string, defaultValue = true): boolean {
    const flagsMap = (this.adapter as unknown as { flags: Map<string, { value: boolean | string }> }).flags;
    const raw = flagsMap?.get(key);
    if (!raw) return defaultValue;
    if (typeof raw.value === "boolean") return raw.value;
    return defaultValue;
  }

  public async listFlags(): Promise<FeatureFlagDefinition[]> {
    return this.adapter.listFlags();
  }

  public async setFlag(key: string, value: boolean | string, description?: string): Promise<void> {
    this.adapter.setFlag(key, value, description);
    await this.saveToDisk();
  }

  public async toggleFlag(key: string): Promise<boolean> {
    const current = await this.adapter.isEnabled(key, undefined, false);
    const updated = !current;
    await this.setFlag(key, updated);
    return updated;
  }

  private isSaving = false;
  private pendingSave = false;

  private async saveToDisk(): Promise<void> {
    if (this.isSaving) {
      this.pendingSave = true;
      return;
    }
    this.isSaving = true;
    try {
      const dir = path.dirname(FEATURE_FLAGS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const flags = await this.adapter.listFlags();
      const record: Record<string, { value: boolean | string; description?: string; category?: string }> = {};
      for (const f of flags) {
        record[f.key] = {
          value: f.defaultValue,
          description: f.description,
          category: f.category,
        };
      }
      fs.writeFileSync(FEATURE_FLAGS_FILE, JSON.stringify(record, null, 2), "utf-8");
    } catch (e) {
      console.error("[FeatureFlags] Failed to persist flags to disk:", e);
    } finally {
      this.isSaving = false;
      if (this.pendingSave) {
        this.pendingSave = false;
        await this.saveToDisk();
      }
    }
  }
}

export const platformFeatureFlags = new PersistentFeatureFlagsManager();
