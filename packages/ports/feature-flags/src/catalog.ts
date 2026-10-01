import type { FeatureFlagDefinition, FeatureEnvironment } from "./index.js";

/**
 * FEATURE_FLAG_REGISTRY
 * Single, canonical source of truth for all platform, app, and domain feature flags in MosaiX.
 */
export const FEATURE_FLAG_REGISTRY = {
  // --- Global & Platform Infrastructure ---
  "platform.dark_mode_default": {
    key: "platform.dark_mode_default",
    description: "Activer le mode sombre par défaut pour les nouveaux utilisateurs",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "platform",
    enabled: true,
  },
  "platform.telemetry.enabled": {
    key: "platform.telemetry.enabled",
    description: "Activation des métriques de tracing et observabilité distribuée",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "platform",
    enabled: true,
  },
  "platform.realtime.transport": {
    key: "platform.realtime.transport",
    description: "Protocole temps réel principal (sse vs websocket)",
    defaultValue: "sse",
    environmentDefaults: { development: "sse", staging: "sse", production: "sse" },
    variationType: "string",
    category: "platform",
    enabled: true,
  },
  "platform.mcp.gateway_enabled": {
    key: "platform.mcp.gateway_enabled",
    description: "Active la passerelle MCP pour les intégrations et les outils agents",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "platform",
    enabled: true,
  },
  "platform.live_editor.enabled": {
    key: "platform.live_editor.enabled",
    description: "Active la barre d'édition de grille et la customisation en direct de l'UI",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: false },
    variationType: "boolean",
    category: "platform",
    enabled: true,
    rolesAllowlist: ["admin", "super-admin"],
  },
  "platform.experimental_plugins": {
    key: "platform.experimental_plugins",
    description: "Active le chargement des extensions communautaires non certifiées",
    defaultValue: false,
    environmentDefaults: { development: true, staging: false, production: false },
    variationType: "boolean",
    category: "platform",
    enabled: true,
    rolesAllowlist: ["admin"],
  },
  "platform.auth.session_login": {
    key: "platform.auth.session_login",
    description: "Authentification de session centralisée v2 (AUTH-06/07)",
    defaultValue: false,
    environmentDefaults: { development: true, staging: false, production: false },
    variationType: "boolean",
    category: "platform",
    enabled: true,
  },

  // --- BAC Applications Master Toggles ---
  "apps.citadelle.enabled": {
    key: "apps.citadelle.enabled",
    description: "Active le module Citadelle (Sécurité, IAM, Audit & Profils)",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "apps",
    enabled: true,
  },
  "apps.solara.enabled": {
    key: "apps.solara.enabled",
    description: "Active le module Solara (Réseau social, Flux d'actualité & Publications)",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "apps",
    enabled: true,
  },
  "apps.beam.enabled": {
    key: "apps.beam.enabled",
    description: "Active le module Beam (Messagerie directe, canaux d'équipe & chat)",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "apps",
    enabled: true,
  },
  "apps.commerce.enabled": {
    key: "apps.commerce.enabled",
    description: "Active le module Commerce (Boutique en ligne, paniers & checkout)",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "apps",
    enabled: true,
  },
  "apps.portfolio.enabled": {
    key: "apps.portfolio.enabled",
    description: "Active le module Portfolio (Vitrine des réalisations & galeries)",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "apps",
    enabled: true,
  },
  "apps.spaces.enabled": {
    key: "apps.spaces.enabled",
    description: "Active le module Espaces (Gestion des espaces collectifs & contextes)",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "apps",
    enabled: true,
  },
  "apps.solidarity.enabled": {
    key: "apps.solidarity.enabled",
    description: "Active le module Solidarité (Collecte, entraide & distribution)",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "apps",
    enabled: true,
  },
  "apps.imperia.enabled": {
    key: "apps.imperia.enabled",
    description: "Active le module Imperia (Console de gouvernance & supervision)",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "apps",
    enabled: true,
    rolesAllowlist: ["admin", "platform-governor"],
  },
  "apps.booking.enabled": {
    key: "apps.booking.enabled",
    description: "Active le module Booking (Prise de rendez-vous et réservation de créneaux)",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "apps",
    enabled: true,
  },
  "apps.subscription.enabled": {
    key: "apps.subscription.enabled",
    description: "Active le module Subscription (Abonnements, formules & récurrences)",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "apps",
    enabled: true,
  },

  // --- Citadelle IAM Flags ---
  "citadelle.mfa.enforced": {
    key: "citadelle.mfa.enforced",
    description: "Exiger le second facteur TOTP pour tous les rôles d'administration",
    defaultValue: false,
    environmentDefaults: { development: false, staging: true, production: true },
    variationType: "boolean",
    category: "security",
    enabled: true,
  },
  "citadelle.registration.wizard": {
    key: "citadelle.registration.wizard",
    description: "Assistant d'inscription multi-étapes avec validation progressive",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "security",
    enabled: true,
  },

  // --- Imperia Governance Flags ---
  "imperia.dlq.auto_replay": {
    key: "imperia.dlq.auto_replay",
    description: "Rejeu automatique des événements DLQ après résolution de panne",
    defaultValue: false,
    environmentDefaults: { development: true, staging: false, production: false },
    variationType: "boolean",
    category: "governance",
    enabled: false,
  },
  "imperia.circuit_breaker.strict_mode": {
    key: "imperia.circuit_breaker.strict_mode",
    description: "Basculer immédiatement les circuits en état OPEN dès 3 échecs consécutifs",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "governance",
    enabled: true,
  },
  "imperia.settings.dynamic_override": {
    key: "imperia.settings.dynamic_override",
    description: "Autorise les modifications dynamiques de configuration sans redémarrer",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "governance",
    enabled: true,
  },
  "imperia.governance.voting_live": {
    key: "imperia.governance.voting_live",
    description: "Session de vote et soumission de propositions en direct",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "governance",
    enabled: true,
  },

  // --- Solara Social Flags ---
  "solara.moderation.ai_filter": {
    key: "solara.moderation.ai_filter",
    description: "Filtrage automatique et modération des publications par IA",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "social",
    enabled: true,
  },
  "solara.posts.showcase_type": {
    key: "solara.posts.showcase_type",
    description: "Autoriser la publication d'articles avec mise en valeur de produit (showcase)",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "social",
    enabled: true,
  },
  "solara.comments.reactions": {
    key: "solara.comments.reactions",
    description: "Permet les réactions émotionnelles en direct sur les publications",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "social",
    enabled: true,
  },
  "solara.feed.algorithmic_ranking": {
    key: "solara.feed.algorithmic_ranking",
    description: "Classement algorithmique du fil social au lieu du strict chronologique",
    defaultValue: false,
    environmentDefaults: { development: true, staging: false, production: false },
    variationType: "boolean",
    category: "social",
    enabled: false,
  },

  // --- Commerce & Checkout Flags ---
  "commerce.payments.satim_live": {
    key: "commerce.payments.satim_live",
    description: "Bascule paiement réel CIB/Edahabia SATIM vs mode simulateur de test",
    defaultValue: false,
    environmentDefaults: { development: false, staging: false, production: true },
    variationType: "boolean",
    category: "commerce",
    enabled: true,
  },
  "commerce.auctions.enabled": {
    key: "commerce.auctions.enabled",
    description: "Moteur d'enchères publiques avec prix de réserve et anti-sniping",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "commerce",
    enabled: true,
  },
  "commerce.checkout.v2": {
    key: "commerce.checkout.v2",
    description: "Nouveau pipeline de validation de commande avec réservation d'inventaire optimiste",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "commerce",
    enabled: true,
  },
  "commerce.checkout.saga_compensation": {
    key: "commerce.checkout.saga_compensation",
    description: "Exécution automatique des étapes de compensation en cas d'annulation de paiement",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "commerce",
    enabled: true,
  },
  "commerce.checkout.guest_mode": {
    key: "commerce.checkout.guest_mode",
    description: "Permet de finaliser une commande sans compte utilisateur Citadelle",
    defaultValue: false,
    environmentDefaults: { development: true, staging: false, production: false },
    variationType: "boolean",
    category: "commerce",
    enabled: false,
  },

  // --- Beam Messaging Flags ---
  "beam.push.fcm_live": {
    key: "beam.push.fcm_live",
    description: "Bascule notifications push réelles Firebase Cloud Messaging vs mode mock",
    defaultValue: false,
    environmentDefaults: { development: false, staging: true, production: true },
    variationType: "boolean",
    category: "messaging",
    enabled: true,
  },
  "beam.messaging.group_chats": {
    key: "beam.messaging.group_chats",
    description: "Permet la création de conversations de groupe à plusieurs membres dans Beam",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "messaging",
    enabled: true,
  },
  "beam.typing_indicators": {
    key: "beam.typing_indicators",
    description: "Indicateurs de frappe en direct dans les conversations",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "messaging",
    enabled: true,
  },

  // --- Spaces Flags ---
  "spaces.acting_as.enabled": {
    key: "spaces.acting_as.enabled",
    description: "Délégation d'autorité pour agir au nom d'un espace de travail",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "spaces",
    enabled: true,
  },
  "spaces.acting_as.enforce_scopes": {
    key: "spaces.acting_as.enforce_scopes",
    description: "Application stricte des périmètres de délégation pour agir au nom d'un espace",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "spaces",
    enabled: true,
  },
  "spaces.multi_tenancy.cross_space_sharing": {
    key: "spaces.multi_tenancy.cross_space_sharing",
    description: "Autorise le partage de documents et flux entre différents espaces abonnés",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "spaces",
    enabled: true,
  },

  // --- Solidarity & Booking Flags ---
  "solidarity.donations.live": {
    key: "solidarity.donations.live",
    description: "Collecte de dons réels vs mode démonstration",
    defaultValue: false,
    environmentDefaults: { development: false, staging: true, production: true },
    variationType: "boolean",
    category: "solidarity",
    enabled: true,
  },
  "solidarity.emergency_broadcast": {
    key: "solidarity.emergency_broadcast",
    description: "Diffusion prioritaire des alertes d'urgence sur tous les canaux du tenant",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "solidarity",
    enabled: true,
  },
  "booking.instant_confirmation": {
    key: "booking.instant_confirmation",
    description: "Confirmation automatique sans validation manuelle de l'organisateur",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "booking",
    enabled: true,
  },
  "booking.reminders": {
    key: "booking.reminders",
    description: "Notifications automatiques de rappel de rendez-vous (T-24, T-1)",
    defaultValue: true,
    environmentDefaults: { development: true, staging: true, production: true },
    variationType: "boolean",
    category: "booking",
    enabled: true,
  },

  // --- Portfolio Flags ---
  "portfolio.csv.import": {
    key: "portfolio.csv.import",
    description: "Importation massive de produits et variantes par fichier CSV",
    defaultValue: false,
    environmentDefaults: { development: true, staging: false, production: false },
    variationType: "boolean",
    category: "portfolio",
    enabled: true,
  },
} as const satisfies Record<string, FeatureFlagDefinition>;

export type FeatureFlagKey = keyof typeof FEATURE_FLAG_REGISTRY;

export function getCatalogFlags(): FeatureFlagDefinition[] {
  return Object.values(FEATURE_FLAG_REGISTRY) as FeatureFlagDefinition[];
}

export function getDefaultValueForEnvironment(
  flagKey: string,
  env: FeatureEnvironment = "development",
): boolean | string {
  const definition = (FEATURE_FLAG_REGISTRY as Record<string, FeatureFlagDefinition>)[flagKey];
  if (!definition) return false;

  if (definition.environmentDefaults) {
    const envVal = definition.environmentDefaults[env as keyof typeof definition.environmentDefaults];
    if (envVal !== undefined) return envVal;
  }

  return definition.defaultValue;
}

export const FEATURE_FLAG_CATALOG = FEATURE_FLAG_REGISTRY;
