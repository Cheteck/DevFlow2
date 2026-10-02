import type { FeatureFlagDefinition } from "./index.js";

/**
 * FEATURE_FLAG_CATALOG
 * Canonical, single-source-of-truth registry of system, app capability, and domain feature flags across MosaiX.
 */
export const FEATURE_FLAG_CATALOG: Record<string, FeatureFlagDefinition> = {
  // --- Global & Platform Flags ---
  "platform.mcp.gateway_enabled": {
    key: "platform.mcp.gateway_enabled",
    description: "Active la passerelle MCP pour les intégrations et les outils agents.",
    defaultValue: true,
    variationType: "boolean",
    category: "platform",
    enabled: true,
  },
  "platform.live_editor.enabled": {
    key: "platform.live_editor.enabled",
    description: "Active la barre d'édition de grille et la customisation en direct de l'UI.",
    defaultValue: true,
    variationType: "boolean",
    category: "platform",
    enabled: true,
  },
  "platform.experimental_plugins": {
    key: "platform.experimental_plugins",
    description: "Active le chargement des extensions communautaires non certifiées.",
    defaultValue: false,
    variationType: "boolean",
    category: "platform",
    enabled: false,
  },
  "platform.dark_mode_default": {
    key: "platform.dark_mode_default",
    description: "Activer le mode sombre par défaut pour les nouveaux utilisateurs",
    defaultValue: true,
    variationType: "boolean",
    category: "platform",
    enabled: true,
  },
  "platform.telemetry.enabled": {
    key: "platform.telemetry.enabled",
    description: "Activation des métriques de tracing et observabilité distribuée",
    defaultValue: true,
    variationType: "boolean",
    category: "platform",
    enabled: true,
  },
  "platform.realtime.transport": {
    key: "platform.realtime.transport",
    description: "Protocole temps réel principal (sse vs websocket)",
    defaultValue: "sse",
    variationType: "string",
    category: "platform",
    enabled: true,
  },

  // --- BAC Applications Visibility & Operational Switches (10 BACs) ---
  "apps.citadelle.enabled": {
    key: "apps.citadelle.enabled",
    description: "Active le module Citadelle (Sécurité, IAM, Audit & Profils).",
    defaultValue: true,
    variationType: "boolean",
    category: "apps",
    enabled: true,
  },
  "apps.solara.enabled": {
    key: "apps.solara.enabled",
    description: "Active le module Solara (Réseau social, Flux d'actualité & Publications).",
    defaultValue: true,
    variationType: "boolean",
    category: "apps",
    enabled: true,
  },
  "apps.beam.enabled": {
    key: "apps.beam.enabled",
    description: "Active le module Beam (Messagerie directe, canaux d'équipe & chat).",
    defaultValue: true,
    variationType: "boolean",
    category: "apps",
    enabled: true,
  },
  "apps.commerce.enabled": {
    key: "apps.commerce.enabled",
    description: "Active le module Commerce (Boutique en ligne, paniers & checkout).",
    defaultValue: true,
    variationType: "boolean",
    category: "apps",
    enabled: true,
  },
  "apps.portfolio.enabled": {
    key: "apps.portfolio.enabled",
    description: "Active le module Portfolio (Vitrine des réalisations & galeries).",
    defaultValue: true,
    variationType: "boolean",
    category: "apps",
    enabled: true,
  },
  "apps.spaces.enabled": {
    key: "apps.spaces.enabled",
    description: "Active le module Espaces (Gestion des espaces collectifs & contextes).",
    defaultValue: true,
    variationType: "boolean",
    category: "apps",
    enabled: true,
  },
  "apps.solidarity.enabled": {
    key: "apps.solidarity.enabled",
    description: "Active le module Solidarité (Collecte, entraide & distribution).",
    defaultValue: true,
    variationType: "boolean",
    category: "apps",
    enabled: true,
  },
  "apps.imperia.enabled": {
    key: "apps.imperia.enabled",
    description: "Active le module Imperia (Console de gouvernance & supervision).",
    defaultValue: true,
    variationType: "boolean",
    category: "apps",
    enabled: true,
  },
  "apps.booking.enabled": {
    key: "apps.booking.enabled",
    description: "Active le module Booking (Prise de rendez-vous & gestion de créneaux).",
    defaultValue: true,
    variationType: "boolean",
    category: "apps",
    enabled: true,
  },
  "apps.subscription.enabled": {
    key: "apps.subscription.enabled",
    description: "Active le module Subscription (Gestion des abonnements & facturation).",
    defaultValue: true,
    variationType: "boolean",
    category: "apps",
    enabled: true,
  },

  // --- Imperia Governance Flags ---
  "imperia.dlq.auto_replay": {
    key: "imperia.dlq.auto_replay",
    description: "Rejeu automatique des événements DLQ après résolution de panne",
    defaultValue: false,
    variationType: "boolean",
    category: "governance",
    enabled: false,
  },
  "imperia.circuit_breaker.strict_mode": {
    key: "imperia.circuit_breaker.strict_mode",
    description: "Basculer immédiatement les circuits en état OPEN dès 3 échecs consécutifs",
    defaultValue: true,
    variationType: "boolean",
    category: "governance",
    enabled: true,
  },
  "imperia.audit.extended_retention": {
    key: "imperia.audit.extended_retention",
    description: "Rétention prolongée des traces d'audit (365 jours au lieu de 90)",
    defaultValue: false,
    variationType: "boolean",
    category: "governance",
    enabled: false,
  },

  // --- Solara Social Flags ---
  "solara.moderation.ai_filter": {
    key: "solara.moderation.ai_filter",
    description: "Filtrage automatique et modération des publications par IA",
    defaultValue: true,
    variationType: "boolean",
    category: "social",
    enabled: true,
  },
  "solara.posts.showcase_type": {
    key: "solara.posts.showcase_type",
    description: "Autoriser la publication d'articles avec mise en valeur de produit (showcase)",
    defaultValue: true,
    variationType: "boolean",
    category: "social",
    enabled: true,
  },
  "solara.comments.reactions": {
    key: "solara.comments.reactions",
    description: "Permet les réactions émotionnelles en direct sur les publications.",
    defaultValue: true,
    variationType: "boolean",
    category: "social",
    enabled: true,
  },
  "solara.feed.algorithmic_ranking": {
    key: "solara.feed.algorithmic_ranking",
    description: "Classement algorithmique du fil social au lieu du strict chronologique",
    defaultValue: false,
    variationType: "boolean",
    category: "social",
    enabled: false,
  },

  // --- Commerce & Checkout Flags ---
  "commerce.checkout.v2": {
    key: "commerce.checkout.v2",
    description: "Nouveau pipeline de validation de commande avec réservation d'inventaire optimiste",
    defaultValue: true,
    variationType: "boolean",
    category: "commerce",
    enabled: true,
  },
  "commerce.payment.instant_settlement": {
    key: "commerce.payment.instant_settlement",
    description: "Règlement instantané des fonds pour les marchands vérifiés",
    defaultValue: true,
    variationType: "boolean",
    category: "commerce",
    enabled: true,
  },
  "commerce.checkout.guest_mode": {
    key: "commerce.checkout.guest_mode",
    description: "Permet de finaliser une commande sans compte utilisateur Citadelle.",
    defaultValue: false,
    variationType: "boolean",
    category: "commerce",
    enabled: false,
  },

  // --- Beam Messaging Flags ---
  "beam.typing_indicators": {
    key: "beam.typing_indicators",
    description: "Indicateurs de frappe en direct dans les conversations",
    defaultValue: true,
    variationType: "boolean",
    category: "messaging",
    enabled: true,
  },
  "beam.read_receipts": {
    key: "beam.read_receipts",
    description: "Accusés de lecture distribués",
    defaultValue: true,
    variationType: "boolean",
    category: "messaging",
    enabled: true,
  },
  "beam.messaging.group_chats": {
    key: "beam.messaging.group_chats",
    description: "Permet la création de conversations de groupe à plusieurs membres dans Beam.",
    defaultValue: true,
    variationType: "boolean",
    category: "messaging",
    enabled: true,
  },

  // --- Spaces Flags ---
  "spaces.custom_layouts": {
    key: "spaces.custom_layouts",
    description: "Autoriser les gestionnaires d'espace à réorganiser les colonnes de widgets",
    defaultValue: true,
    variationType: "boolean",
    category: "spaces",
    enabled: true,
  },
  "spaces.multi_tenancy.cross_space_sharing": {
    key: "spaces.multi_tenancy.cross_space_sharing",
    description: "Autorise le partage de documents et flux entre différents espaces abonnés.",
    defaultValue: true,
    variationType: "boolean",
    category: "spaces",
    enabled: true,
  },

  // --- Solidarity Flags ---
  "solidarity.emergency_broadcast": {
    key: "solidarity.emergency_broadcast",
    description: "Diffusion prioritaire des alertes d'urgence sur tous les canaux du tenant",
    defaultValue: true,
    variationType: "boolean",
    category: "solidarity",
    enabled: true,
  },

  // --- Booking Flags ---
  "booking.instant_confirmation": {
    key: "booking.instant_confirmation",
    description: "Confirmation automatique sans validation manuelle de l'organisateur",
    defaultValue: true,
    variationType: "boolean",
    category: "booking",
    enabled: true,
  },
};

export type KnownFeatureFlagKey = keyof typeof FEATURE_FLAG_CATALOG;

export function getCatalogFlags(): FeatureFlagDefinition[] {
  return Object.values(FEATURE_FLAG_CATALOG);
}
