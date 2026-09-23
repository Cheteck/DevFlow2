export type SpaceTemplateType =
  | "business"
  | "store"
  | "creator"
  | "education"
  | "organization"
  | "project"
  | "community"
  | "custom";

export interface SpaceTemplate {
  type: SpaceTemplateType;
  name: string;
  description: string;
  recommendedCategory: string;
  recommendedCapabilities: string[];
  initialNavigation: string[];
}

export class SpaceTemplateRegistry {
  private templates = new Map<SpaceTemplateType, SpaceTemplate>([
    [
      "business",
      {
        type: "business",
        name: "Business / Entreprise",
        description: "Présence officielle pour entreprise, PME ou organisation commerciale.",
        recommendedCategory: "business",
        recommendedCapabilities: ["social.posts", "messaging.conversations", "analytics.audience"],
        initialNavigation: ["Home", "About", "Posts", "Contact"],
      },
    ],
    [
      "store",
      {
        type: "store",
        name: "Store / Boutique",
        description: "Pour commerçants et boutiques souhaitant vendre en ligne.",
        recommendedCategory: "business",
        recommendedCapabilities: [
          "social.posts",
          "messaging.conversations",
          "commerce.products",
          "commerce.catalog",
          "commerce.orders",
          "commerce.checkout",
          "analytics.sales",
        ],
        initialNavigation: ["Shop", "Products", "Posts", "About"],
      },
    ],
    [
      "creator",
      {
        type: "creator",
        name: "Creator / Personnalité",
        description: "Pour créateurs de contenu, artistes, influenceurs et personnalités.",
        recommendedCategory: "personality",
        recommendedCapabilities: ["social.posts", "social.comments", "social.followers", "messaging.conversations"],
        initialNavigation: ["Posts", "Photos", "Videos", "About"],
      },
    ],
    [
      "education",
      {
        type: "education",
        name: "Education / École",
        description: "Pour écoles, formateurs, universités et organismes de formation.",
        recommendedCategory: "organization",
        recommendedCapabilities: ["social.posts", "education.courses", "events.tickets", "messaging.conversations"],
        initialNavigation: ["Courses", "Events", "Posts", "About"],
      },
    ],
    [
      "custom",
      {
        type: "custom",
        name: "Custom / Configuration Libre",
        description: "Configuration vierge à personnaliser entièrement selon vos besoins.",
        recommendedCategory: "brand",
        recommendedCapabilities: ["social.posts"],
        initialNavigation: ["Home", "About"],
      },
    ],
  ]);

  getTemplate(type: SpaceTemplateType): SpaceTemplate {
    return this.templates.get(type) ?? this.templates.get("custom")!;
  }

  listTemplates(): SpaceTemplate[] {
    return Array.from(this.templates.values());
  }
}
