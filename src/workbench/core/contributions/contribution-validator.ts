/**
 * @mosaix/workbench — Contribution Validators
 *
 * Validation des contributions avant leur entrée dans le registre.
 *
 * La validation de l'enveloppe ContributionContract seule ne suffit pas :
 * chaque kind doit voir la structure réelle de son contenu contrôlée, ainsi
 * que ses placements, ses références et sa version de contrat.
 *
 * Réutilise ContributionContract, ExperienceKind et PlacementContract de
 * @mosaix/contracts. Aucun nouveau contrat n'est créé.
 */

import type {
  ContributionContract,
  ExperienceKind,
  PlacementContract,
} from "@mosaix/contracts";
import {
  ContributionRegistryError,
  ContributionValidationError,
} from "@mosaix/workbench/core/contributions/errors.js";

/**
 * Validateur de contenu dédié à un kind spécifique.
 *
 * Contrôle la structure réelle de content selon le kind, ainsi que la
 * cohérence entre le kind et le contrat porté.
 */
export interface ContentValidator<K extends ExperienceKind = ExperienceKind> {
  kind: K;
  /**
   * Valide le contenu d'une contribution de ce kind.
   * Lève ContributionValidationError si le contenu est invalide.
   */
  validateContent(content: unknown): void;
}

/**
 * Valide l'enveloppe ContributionContract commune à toutes les contributions.
 *
 * Contrôle :
 * - la structure de l'enveloppe (id, contractVersion, ownerApp, kind, title) ;
 * - la version du contrat ("1.0.0") ;
 * - la validité des placements et de leurs références.
 *
 * Ne valide pas le contenu spécifique au kind : c'est le rôle des
 * ContentValidators enregistrés par kind.
 */
export function validateContributionEnvelope(
  raw: unknown,
): ContributionContract {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw)
  ) {
    throw new ContributionValidationError(
      "Contribution must be a non-null object.",
    );
  }

  const c = raw as Record<string, unknown>;

  const id =
    typeof c.id === "string" && c.id.length > 0
      ? c.id
      : (() => {
          throw new ContributionValidationError(
            'Contribution is missing a non-empty "id" field.',
          );
        })();

  const contractVersion =
    typeof c.contractVersion === "string"
      ? c.contractVersion
      : (() => {
          throw new ContributionValidationError(
            'Contribution is missing a "contractVersion" field.',
          );
        })();

  if (contractVersion !== "1.0.0") {
    throw new ContributionValidationError(
      `Unsupported contractVersion "${contractVersion}". Expected "1.0.0".`,
    );
  }

  const ownerApp =
    typeof c.ownerApp === "string" && c.ownerApp.length > 0
      ? c.ownerApp
      : (() => {
          throw new ContributionValidationError(
            'Contribution is missing a non-empty "ownerApp" field.',
          );
        })();

  const kind =
    typeof c.kind === "string"
      ? c.kind
      : (() => {
          throw new ContributionValidationError(
            'Contribution is missing a "kind" field.',
          );
        })();

  const validKinds = [
    "navigation",
    "action",
    "insight",
    "badge",
    "avatar",
    "section",
    "widget",
    "command",
    "page",
    "component",
  ] as const;
  if (!validKinds.includes(kind as ExperienceKind)) {
    throw new ContributionValidationError(
      `Unknown contribution kind "${kind}".`,
    );
  }

  const title =
    typeof c.title === "string" && c.title.length > 0
      ? c.title
      : (() => {
          throw new ContributionValidationError(
            'Contribution is missing a non-empty "title" field.',
          );
        })();

  const placements = validatePlacements(c.placements);

  const policies = c.policies !== undefined ? normalizePolicies(c.policies) : undefined;

  return {
    id,
    contractVersion: "1.0.0",
    ownerApp,
    kind: kind as ExperienceKind,
    title,
    description:
      typeof c.description === "string" ? c.description : undefined,
    icon: typeof c.icon === "string" ? c.icon : undefined,
    route: typeof c.route === "string" ? c.route : undefined,
    placements,
    policies,
    metadata:
      c.metadata && typeof c.metadata === "object" && !Array.isArray(c.metadata)
        ? (c.metadata as Record<string, unknown>)
        : undefined,
    content:
      c.content && typeof c.content === "object" && !Array.isArray(c.content)
        ? (c.content as Record<string, unknown>)
        : undefined,
  };
}

/**
 * Valide le tableau des placements d'une contribution.
 *
 * Contrôle que chaque placement a un id, un surfaceId et un slotId non vides,
 * ainsi que des valeurs numériques optionnelles (order, priority, gridSpan).
 */
export function validatePlacements(
  raw: unknown,
): PlacementContract[] {
  if (!Array.isArray(raw)) {
    throw new ContributionValidationError(
      'Contribution "placements" must be an array.',
    );
  }

  return raw.map((p, index) => {
    if (!p || typeof p !== "object") {
      throw new ContributionValidationError(
        `Placement at index ${index} must be an object.`,
      );
    }
    const placement = p as Record<string, unknown>;

    if (
      typeof placement.id !== "string" ||
      placement.id.length === 0
    ) {
      throw new ContributionValidationError(
        `Placement at index ${index} requires a non-empty "id".`,
      );
    }
    if (
      typeof placement.surfaceId !== "string" ||
      placement.surfaceId.length === 0
    ) {
      throw new ContributionValidationError(
        `Placement "${placement.id}" requires a non-empty "surfaceId".`,
      );
    }
    if (
      typeof placement.slotId !== "string" ||
      placement.slotId.length === 0
    ) {
      throw new ContributionValidationError(
        `Placement "${placement.id}" requires a non-empty "slotId".`,
      );
    }

    if (placement.order !== undefined && typeof placement.order !== "number") {
      throw new ContributionValidationError(
        `Placement "${placement.id}" order must be a number when provided.`,
      );
    }
    if (
      placement.priority !== undefined &&
      typeof placement.priority !== "number"
    ) {
      throw new ContributionValidationError(
        `Placement "${placement.id}" priority must be a number when provided.`,
      );
    }
    if (
      placement.gridSpan !== undefined &&
      (typeof placement.gridSpan !== "number" ||
        placement.gridSpan < 1 ||
        placement.gridSpan > 12)
    ) {
      throw new ContributionValidationError(
        `Placement "${placement.id}" gridSpan must be a number between 1 and 12 when provided.`,
      );
    }

    return {
      id: placement.id,
      surfaceId: placement.surfaceId,
      slotId: placement.slotId,
      order:
        typeof placement.order === "number" ? placement.order : undefined,
      priority:
        typeof placement.priority === "number"
          ? placement.priority
          : undefined,
      gridSpan:
        typeof placement.gridSpan === "number"
          ? placement.gridSpan
          : undefined,
      responsiveSpan:
        placement.responsiveSpan &&
        typeof placement.responsiveSpan === "object" &&
        !Array.isArray(placement.responsiveSpan)
          ? (placement.responsiveSpan as {
              mobile?: number;
              tablet?: number;
              desktop?: number;
            })
          : undefined,
      wrapper:
        typeof placement.wrapper === "string"
          ? (placement.wrapper as
              | "card"
              | "hero-strip"
              | "collapsible"
              | "panel"
              | "borderless"
              | "glass"
              | "pill")
          : undefined,
      hidden:
        typeof placement.hidden === "boolean"
          ? placement.hidden
          : undefined,
      payload:
        placement.payload &&
        typeof placement.payload === "object" &&
        !Array.isArray(placement.payload)
          ? (placement.payload as Record<string, unknown>)
          : undefined,
    };
  });
}

function normalizePolicies(raw: unknown): ContributionContract["policies"] {
  const p = raw as Record<string, unknown>;
  return {
    requiredPermissions: Array.isArray(p.requiredPermissions)
      ? p.requiredPermissions.filter(
          (id): id is string => typeof id === "string",
        )
      : undefined,
    requiredCapabilities: Array.isArray(p.requiredCapabilities)
      ? p.requiredCapabilities.filter(
          (id): id is string => typeof id === "string",
        )
      : undefined,
    allowedTenants: Array.isArray(p.allowedTenants)
      ? p.allowedTenants.filter((id): id is string => typeof id === "string")
      : undefined,
    supportedDevices: Array.isArray(p.supportedDevices)
      ? p.supportedDevices.filter(
          (d): d is "desktop" | "tablet" | "mobile" =>
            d === "desktop" || d === "tablet" || d === "mobile",
        )
      : undefined,
    routePattern:
      typeof p.routePattern === "string" ? p.routePattern : undefined,
    customRule:
      typeof p.customRule === "string" ? p.customRule : undefined,
  };
}

/**
 * Registre des validateurs de contenu par kind.
 *
 * Chaque kind peut avoir un validateur dédié qui contrôle la structure
 * réelle de son contenu. L'absence de validateur pour un kind signifie
 * que seul l'enveloppe est validée (le contenu n'est pas structuralement
 * vérifié au-delà d'être un objet).
 */
export class ContentValidators {
  private validators = new Map<ExperienceKind, ContentValidator>();

  register(validator: ContentValidator): void {
    if (this.validators.has(validator.kind)) {
      throw new ContributionRegistryError(
        `A content validator is already registered for kind "${validator.kind}".`,
      );
    }
    this.validators.set(validator.kind, validator);
  }

  get(kind: ExperienceKind): ContentValidator | undefined {
    return this.validators.get(kind);
  }

  has(kind: ExperienceKind): boolean {
    return this.validators.has(kind);
  }
}

/** Instance par défaut des validateurs de contenu. */
export const contentValidators = new ContentValidators();

/**
 * Validateur de contenu pour le kind "widget".
 *
 * Le contenu doit être un WidgetContract compatible :
 * { id?, title?, capabilityId?, requiresPermission? }.
 */
export const widgetContentValidator: ContentValidator<"widget"> = {
  kind: "widget",
  validateContent(content: unknown): void {
    if (!content || typeof content !== "object" || Array.isArray(content)) {
      throw new ContributionValidationError(
        'Contribution kind "widget" requires a content object.',
      );
    }
    const c = content as Record<string, unknown>;
    if (c.id !== undefined && typeof c.id !== "string") {
      throw new ContributionValidationError(
        'Contribution kind "widget": content.id must be a string when provided.',
      );
    }
    if (c.title !== undefined && typeof c.title !== "string") {
      throw new ContributionValidationError(
        'Contribution kind "widget": content.title must be a string when provided.',
      );
    }
    if (c.capabilityId !== undefined && typeof c.capabilityId !== "string") {
      throw new ContributionValidationError(
        'Contribution kind "widget": content.capabilityId must be a string when provided.',
      );
    }
    if (c.requiresPermission !== undefined && typeof c.requiresPermission !== "string") {
      throw new ContributionValidationError(
        'Contribution kind "widget": content.requiresPermission must be a string when provided.',
      );
    }
  },
};

/**
 * Validateur de contenu pour le kind "navigation".
 *
 * Le contenu doit être un NavigationContract compatible :
 * { items: Array<{ id, label, target, order?, requiresPermission? }> }.
 */
export const navigationContentValidator: ContentValidator<"navigation"> = {
  kind: "navigation",
  validateContent(content: unknown): void {
    if (!content || typeof content !== "object" || Array.isArray(content)) {
      throw new ContributionValidationError(
        'Contribution kind "navigation" requires a content object.',
      );
    }
    const c = content as Record<string, unknown>;
    if (!Array.isArray(c.items)) {
      throw new ContributionValidationError(
        'Contribution kind "navigation": content.items must be an array.',
      );
    }
    c.items.forEach((item, index) => {
      if (!item || typeof item !== "object") {
        throw new ContributionValidationError(
          `Contribution kind "navigation": items[${index}] must be an object.`,
        );
      }
      const it = item as Record<string, unknown>;
      if (typeof it.id !== "string" || it.id.length === 0) {
        throw new ContributionValidationError(
          `Contribution kind "navigation": items[${index}] requires a non-empty "id".`,
        );
      }
      if (typeof it.label !== "string" || it.label.length === 0) {
        throw new ContributionValidationError(
          `Contribution kind "navigation": items[${index}] requires a non-empty "label".`,
        );
      }
      if (typeof it.target !== "string" || it.target.length === 0) {
        throw new ContributionValidationError(
          `Contribution kind "navigation": items[${index}] requires a non-empty "target".`,
        );
      }
    });
  },
};

// Enregistre les validateurs par défaut.
contentValidators.register(widgetContentValidator);
contentValidators.register(navigationContentValidator);
