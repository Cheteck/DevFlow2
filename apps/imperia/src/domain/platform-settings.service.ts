import { featureAsync } from "@mosaix/sdk";

export type SettingCategory =
  | "general"
  | "security"
  | "governance"
  | "plugins"
  | "appearance"
  | "telemetry"
  | "storage";

export interface SettingDefinition {
  key: string;
  category: SettingCategory;
  label: string;
  description: string;
  type: "text" | "number" | "boolean" | "select";
  defaultValue: string;
  options?: Array<{ label: string; value: string }>;
}

export interface SettingRecord {
  key: string;
  value: string;
  source: "environment" | "database_override";
  updatedAt: string;
  definition?: SettingDefinition;
}

export const CANONICAL_SETTINGS_DEFINITIONS: SettingDefinition[] = [
  // 1. Général & Cluster
  {
    key: "MOSAIX_CLUSTER_NAME",
    category: "general",
    label: "Nom du Cluster",
    description: "Nom d'identification public du cluster coordinateur MosaiX.",
    type: "text",
    defaultValue: "MosaiX High-Availability Cluster",
  },
  {
    key: "NODE_ENV",
    category: "general",
    label: "Environnement d'Exécution",
    description: "Mode d'exécution actuel du moteur (production, staging, development).",
    type: "select",
    defaultValue: "production",
    options: [
      { label: "Production", value: "production" },
      { label: "Staging / Pré-production", value: "staging" },
      { label: "Développement", value: "development" },
    ],
  },
  {
    key: "MOSAIX_DEFAULT_BAC",
    category: "general",
    label: "Application par Défaut",
    description: "Application d'accueil chargée automatiquement à l'ouverture du Shell.",
    type: "select",
    defaultValue: "@apps/imperia",
    options: [
      { label: "Imperia (Gouvernance)", value: "@apps/imperia" },
      { label: "Solara (Social & Feed)", value: "@apps/solara" },
      { label: "Beam (Messagerie)", value: "@apps/beam" },
      { label: "Commerce (Boutique)", value: "@apps/commerce" },
      { label: "Spaces (Espaces)", value: "@apps/spaces" },
      { label: "Citadelle (Identité)", value: "@apps/citadelle" },
    ],
  },
  {
    key: "MOSAIX_MAINTENANCE_MODE",
    category: "general",
    label: "Mode Maintenance Global",
    description: "Bloque les contributions et écritures des membres tout en maintenant l'accès admin.",
    type: "boolean",
    defaultValue: "false",
  },
  {
    key: "MOSAIX_TIMEZONE",
    category: "general",
    label: "Fuseau Horaire de Référence",
    description: "Fuseau horaire utilisé pour l'agrégation des métriques et logs.",
    type: "text",
    defaultValue: "UTC",
  },

  // 2. Sécurité & IAM
  {
    key: "MOSAIX_MFA_ENFORCED",
    category: "security",
    label: "Forcer la Validation MFA",
    description: "Exige l'authentification à deux facteurs pour les modérateurs et administrateurs.",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "MOSAIX_SESSION_TTL_SECONDS",
    category: "security",
    label: "Durée de Session SSO (Secondes)",
    description: "Durée de validité des jetons d'accès JWT avant réauthentification.",
    type: "number",
    defaultValue: "86400",
  },
  {
    key: "MOSAIX_AUTH_ISSUER",
    category: "security",
    label: "Émetteur d'Authentification (Issuer)",
    description: "Identifiant URI de l'autorité SSO de délivrance des jetons.",
    type: "text",
    defaultValue: "https://auth.mosaix.internal",
  },
  {
    key: "MOSAIX_MAX_LOGIN_ATTEMPTS",
    category: "security",
    label: "Tentatives de Connexion Maximales",
    description: "Nombre de tentatives erronées autorisées avant blocage anti-brute force.",
    type: "number",
    defaultValue: "5",
  },
  {
    key: "MOSAIX_CORS_ALLOWED_ORIGINS",
    category: "security",
    label: "Origines CORS Autorisées",
    description: "Liste des domaines autorisés séparés par des virgules (* pour tout autoriser).",
    type: "text",
    defaultValue: "*",
  },

  // 3. Politiques & Conformité BAC
  {
    key: "MOSAIX_TENANT_ISOLATION_STRATEGY",
    category: "governance",
    label: "Stratégie d'Isolation Multi-Tenant",
    description: "Niveau d'étanchéité des canaux et des bases de données par organisation.",
    type: "select",
    defaultValue: "strict",
    options: [
      { label: "Strict (Bases & Canaux isolés)", value: "strict" },
      { label: "Hybride (Canaux partagés, ACLs strictes)", value: "hybrid" },
      { label: "Ouvert (Réseau de développement)", value: "open" },
    ],
  },
  {
    key: "MOSAIX_SEMVER_STRICT_CHECK",
    category: "governance",
    label: "Contrôle Strict SemVer des Contrats BAC",
    description: "Rejeter immédiatement tout BAC dont la version dérive des contrats de la plateforme.",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "MOSAIX_DEFAULT_POLICY_EFFECT",
    category: "governance",
    label: "Effet par Défaut des Politiques Non Définies",
    description: "Action à appliquer lorsqu'aucune règle explicite ne correspond.",
    type: "select",
    defaultValue: "allow",
    options: [
      { label: "Autoriser (Allow)", value: "allow" },
      { label: "Refuser (Deny)", value: "deny" },
    ],
  },

  // 4. Feature Flags & Plugins
  {
    key: "imperia.settings.dynamic_override",
    category: "plugins",
    label: "Surcharge Dynamique des Paramètres",
    description: "Permet la modification à chaud des paramètres en mémoire sans redémarrage serveur.",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "imperia.plugins.sandbox_isolation",
    category: "plugins",
    label: "Isolation Sandbox des Extensions BAC",
    description: "Exécute les hooks des plugins tiers dans un sous-contexte sécurisé.",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "solara.ai_moderation.enabled",
    category: "plugins",
    label: "Modération IA Automatique Solara",
    description: "Active l'analyse automatique des publications via le modèle de filtrage.",
    type: "boolean",
    defaultValue: "true",
  },

  // 5. Apparence & Thèmes
  // NOTE: options synchronised with themes/*/theme.json (2026-09-26).
  // The live source is GET /api/admin/platform-theme (discovery-driven);
  // this catalog stays accurate for offline/admin reference.
  {
    key: "MOSAIX_DEFAULT_THEME",
    category: "appearance",
    label: "Thème Shell par Défaut",
    description: "Palette et style visuel appliqués par défaut à l'ensemble du portail. Choix admin persisté en base (platform_settings.platform_theme_id).",
    type: "select",
    defaultValue: "mosaix-default",
    options: [
      { label: "MosaiX Default", value: "mosaix-default" },
      { label: "Arctic", value: "arctic" },
      { label: "Aurora", value: "aurora" },
      { label: "Cobalt", value: "cobalt" },
      { label: "Copper", value: "copper" },
      { label: "Desert", value: "desert" },
      { label: "Forest", value: "forest" },
      { label: "Lime", value: "lime" },
      { label: "Luxury", value: "luxury" },
      { label: "Midnight", value: "midnight" },
      { label: "Midnight Ocean", value: "midnight-ocean" },
      { label: "Monochrome", value: "monochrome" },
      { label: "Nordic", value: "nordic" },
      { label: "Ocean", value: "ocean" },
      { label: "Paper", value: "paper" },
      { label: "Plum", value: "plum" },
      { label: "Sage", value: "sage" },
      { label: "Sunset", value: "sunset" },
      { label: "Terracotta", value: "terracotta" },
    ],
  },
  {
    key: "MOSAIX_COLOR_MODE",
    category: "appearance",
    label: "Mode de Couleur Forcé",
    description: "Force un mode spécifique ou s'adapte aux préférences utilisateur.",
    type: "select",
    defaultValue: "dark",
    options: [
      { label: "Sombre (Dark)", value: "dark" },
      { label: "Clair (Light)", value: "light" },
      { label: "Automatique (Préférence système)", value: "auto" },
    ],
  },
  {
    key: "MOSAIX_UI_BORDER_RADIUS",
    category: "appearance",
    label: "Rayon de Courbure des Composants (Tokens UI)",
    description: "Style d'arrondi appliqué aux conteneurs et boutons du Shell.",
    type: "select",
    defaultValue: "rounded-xl",
    options: [
      { label: "Standard (12px / rounded-xl)", value: "rounded-xl" },
      { label: "Prononcé (16px / rounded-2xl)", value: "rounded-2xl" },
      { label: "Discret (8px / rounded-lg)", value: "rounded-lg" },
    ],
  },

  // 6. Télémétrie & Logs
  {
    key: "MOSAIX_LOG_LEVEL",
    category: "telemetry",
    label: "Niveau de Log Global",
    description: "Verbosité minimale des logs collectés par le bus de télémétrie.",
    type: "select",
    defaultValue: "INFO",
    options: [
      { label: "DEBUG (Très verbeux)", value: "DEBUG" },
      { label: "INFO (Nominal)", value: "INFO" },
      { label: "WARN (Avertissements)", value: "WARN" },
      { label: "ERROR (Erreurs critiques uniquement)", value: "ERROR" },
    ],
  },
  {
    key: "MOSAIX_RATE_LIMIT_RPM",
    category: "telemetry",
    label: "Seuil de Limitation de Débit (Req/Min)",
    description: "Nombre maximal de requêtes autorisées par minute par adresse IP.",
    type: "number",
    defaultValue: "1200",
  },
  {
    key: "MOSAIX_AUDIT_RETENTION_DAYS",
    category: "telemetry",
    label: "Rétention des Logs d'Audit (Jours)",
    description: "Nombre de jours pendant lesquels les événements d'audit sont conservés.",
    type: "number",
    defaultValue: "90",
  },

  // 7. Stockage & Quotas
  {
    key: "MOSAIX_DEFAULT_SPACE_QUOTA_GB",
    category: "storage",
    label: "Quota par Défaut des Espaces Spaces (GB)",
    description: "Espace disque maximal alloué lors de la création d'un nouvel espace de travail.",
    type: "number",
    defaultValue: "5",
  },
  {
    key: "MOSAIX_STORAGE_DRIVER",
    category: "storage",
    label: "Pilote de Stockage des Fichiers",
    description: "Infrastructure de stockage pour les assets et documents.",
    type: "select",
    defaultValue: "local",
    options: [
      { label: "Système de Fichiers Local (/public & /storage)", value: "local" },
      { label: "Cloud Object Storage (GCS / S3 compatible)", value: "cloud" },
    ],
  },
  {
    key: "MOSAIX_CACHE_STRATEGY",
    category: "storage",
    label: "Stratégie de Cache Transversale",
    description: "Gestionnaire de cache utilisé pour les requêtes inter-BACs.",
    type: "select",
    defaultValue: "memory",
    options: [
      { label: "En-Mémoire LRU (Ultra-rapide)", value: "memory" },
      { label: "Cache Distribué Redis", value: "redis" },
    ],
  },
];

export interface SettingsRepositoryPort {
  setSetting(key: string, value: string): Promise<void>;
  getSettings(): Promise<Record<string, string>>;
}

export class PlatformSettingsService {
  private overrides = new Map<string, string>();
  private definitions = new Map<string, SettingDefinition>();
  private hasLoadedSettingsFromDb = false;

  constructor(
    private readonly repository?: SettingsRepositoryPort,
    private readonly envConfig: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {}
  ) {
    for (const def of CANONICAL_SETTINGS_DEFINITIONS) {
      this.definitions.set(def.key, def);
    }
  }

  private async ensureSettingsLoaded(): Promise<void> {
    if (this.hasLoadedSettingsFromDb || !this.repository) return;
    try {
      const dbSettings = await this.repository.getSettings();
      for (const [key, val] of Object.entries(dbSettings)) {
        this.overrides.set(key, val);
      }
      this.hasLoadedSettingsFromDb = true;
    } catch (err: unknown) {
      console.error("[Settings] Failed to load settings from DB:", err);
    }
  }

  async setOverride(key: string, value: string): Promise<void> {
    this.overrides.set(key, value);
    if (this.repository) {
      await this.repository.setSetting(key, value);
    }
  }

  async setMultipleOverrides(updates: Record<string, string>): Promise<void> {
    for (const [key, val] of Object.entries(updates)) {
      const stringVal = String(val);
      this.overrides.set(key, stringVal);
      if (this.repository) {
        await this.repository.setSetting(key, stringVal);
      }
    }
  }

  async getSetting(key: string, defaultValue?: string): Promise<SettingRecord> {
    await this.ensureSettingsLoaded();
    const definition = this.definitions.get(key);
    const fallback = defaultValue ?? definition?.defaultValue ?? "";
    const allowDynamicOverrides = await featureAsync("imperia.settings.dynamic_override", true);

    if (allowDynamicOverrides && this.overrides.has(key)) {
      return {
        key,
        value: this.overrides.get(key)!,
        source: "database_override",
        updatedAt: new Date().toISOString(),
        definition,
      };
    }

    return {
      key,
      value: this.envConfig[key] ?? fallback,
      source: "environment",
      updatedAt: new Date().toISOString(),
      definition,
    };
  }

  async listSettings(): Promise<SettingRecord[]> {
    await this.ensureSettingsLoaded();
    const keys = Array.from(this.definitions.keys());
    const records: SettingRecord[] = [];
    for (const key of keys) {
      records.push(await this.getSetting(key));
    }
    return records;
  }

  async getSettingsByCategory(category: SettingCategory): Promise<SettingRecord[]> {
    await this.ensureSettingsLoaded();
    const categoryDefs = CANONICAL_SETTINGS_DEFINITIONS.filter((d) => d.category === category);
    const records: SettingRecord[] = [];
    for (const def of categoryDefs) {
      records.push(await this.getSetting(def.key));
    }
    return records;
  }
}

