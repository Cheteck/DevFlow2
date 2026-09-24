/**
 * @shell/imperia-nav — Externalized Navigation Contributions for Imperia Senat Admin
 * Implements Recommendation 1 of the Extensibility Architecture Report.
 */

export interface ImperiaNavSection {
  title: string;
  badgeCount: number;
  items: {
    id: string;
    label: string;
    icon: string;
    searchKeywords: string;
    badgeText?: string;
    badgeClass?: string;
    isLive?: boolean;
    isPort?: boolean;
  }[];
}

export const IMPERIA_NAV_SECTIONS: ImperiaNavSection[] = [
  {
    title: "Cœur de Plateforme",
    badgeCount: 4,
    items: [
      {
        id: "metrics",
        label: "Métriques & Logs",
        icon: "monitoring",
        searchKeywords: "métriques logs télémétrie cluster monitoring",
        badgeText: "LIVE",
        badgeClass: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
        isLive: true
      },
      {
        id: "feature-flags",
        label: "Feature Flags",
        icon: "toggle_on",
        searchKeywords: "feature flags bascules toggles capacités modules runtime",
        badgeText: "PORTS",
        badgeClass: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
        isPort: true
      },
      {
        id: "contracts",
        label: "Contrats & Diagnostics",
        icon: "approval_delegation",
        searchKeywords: "contrats diagnostics conformité bac audit",
        badgeText: "6/6",
        badgeClass: "bg-primary/20 text-primary border border-primary/30"
      },
      {
        id: "settings",
        label: "Configuration Cluster",
        icon: "settings_applications",
        searchKeywords: "configuration cluster cluster settings système",
        badgeText: "VITE",
        badgeClass: "bg-surface-variant/50 text-on-surface-variant"
      }
    ]
  },
  {
    title: "Gestionnaires BAC",
    badgeCount: 6,
    items: [
      {
        id: "identity-admin",
        label: "Gestion Utilisateurs",
        icon: "manage_accounts",
        searchKeywords: "gestion utilisateurs sso auth identity",
        badgeText: "SSO",
        badgeClass: "bg-purple-500/20 text-purple-300 border border-purple-500/30"
      },
      {
        id: "solara-admin",
        label: "Modération Solara",
        icon: "shield",
        searchKeywords: "modération solara feed ia sécurité",
        badgeText: "IA",
        badgeClass: "bg-amber-500/20 text-amber-300 border border-amber-500/30"
      },
      {
        id: "beam-admin",
        label: "Supervision Beam",
        icon: "forum",
        searchKeywords: "supervision beam messenger chat websocket",
        badgeText: "RTC",
        badgeClass: "bg-blue-500/20 text-blue-300 border border-blue-500/30"
      },
      {
        id: "spaces-admin",
        label: "Quotas d'Espaces",
        icon: "workspaces",
        searchKeywords: "quotas espaces spaces storage partition",
        badgeText: "STORE",
        badgeClass: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
      },
      {
        id: "commerce-admin",
        label: "Livre Commerce",
        icon: "shopping_bag",
        searchKeywords: "livre commerce boutique commandes transactions",
        badgeText: "PAY",
        badgeClass: "bg-pink-500/20 text-pink-300 border border-pink-500/30"
      },
      {
        id: "portfolio-admin",
        label: "Registre Créatif",
        icon: "palette",
        searchKeywords: "registre créatif portfolio vitrine art",
        badgeText: "NFT",
        badgeClass: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
      }
    ]
  }
];
