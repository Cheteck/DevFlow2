/**
 * @mosaix/workbench — Contribution Registry
 *
 * Registre central et typé des contributions du Workbench.
 *
 * Un seul registre, des entrées typées par kind (ExperienceKind), avec un
 * validateur dédié par type. L'unification du registre ne signifie pas
 * l'uniformisation forcée des contrats : chaque kind conserve son contrat
 * propre (ContributionContract, NavigationContract, LayoutContract,
 * WidgetContract, etc.).
 *
 * Réutilise ContributionContract et ExperienceKind de @mosaix/contracts.
 * Aucun nouveau contrat de contribution n'est créé.
 */

import type {
  ContributionContract,
  ExperienceKind,
} from "@mosaix/contracts";
import {
  ContentValidators,
  contentValidators,
  validateContributionEnvelope,
} from "@mosaix/workbench/core/contributions/contribution-validator.js";
import { ContributionRegistryError } from "@mosaix/workbench/core/contributions/errors.js";

/**
 * Entrée typée du registre : la contribution validée et son kind.
 */
export interface TypedContributionEntry {
  kind: ExperienceKind;
  contribution: ContributionContract;
}

/**
 * Registre central des contributions.
 *
 * Garanties :
 * - identifiants uniques (conflit détecté explicitement) ;
 * - aucune contribution invalide n'entre dans le registre ;
 * - résolution déterministe ;
 * - pas de corruption du registre en cas d'enregistrement refusé.
 */
export class ContributionRegistry {
  private entries = new Map<string, TypedContributionEntry>();
  private contentValidators: ContentValidators;

  constructor(contentValidators: ContentValidators) {
    this.contentValidators = contentValidators;
  }

  /**
   * Enregistre une contribution après validation.
   *
   * Lève ContributionRegistryError si :
   * - l'identifiant est déjà utilisé (conflit explicite) ;
   * - la contribution est invalide (enveloppe, version, placements,
   *   cohérence kind/contrat, contenu selon le kind).
   *
   * Aucun enregistrement partiel n'est effectué en cas d'échec : le
   * registre n'est jamais corrompu.
   */
  register(contribution: unknown): ContributionContract {
    // 1. Validation de l'enveloppe et des placements.
    const validated = validateContributionEnvelope(contribution);

    // 2. Validation du contenu spécifique au kind, si un validateur existe.
    const validator = this.contentValidators.get(validated.kind);
    if (validator) {
      validator.validateContent(validated.content);
    }

    // 3. Vérification d'unicité de l'identifiant (dernière étape, après
    //    validation réussie, pour ne pas enregistrer une contribution invalide).
    if (this.entries.has(validated.id)) {
      throw new ContributionRegistryError(
        `Contribution ID "${validated.id}" is already registered.`,
      );
    }

    const entry: TypedContributionEntry = {
      kind: validated.kind,
      contribution: validated,
    };
    this.entries.set(validated.id, entry);
    return validated;
  }

  /**
   * Remplace une contribution existante (même contrat de validation).
   */
  override(contribution: unknown): ContributionContract {
    const validated = validateContributionEnvelope(contribution);

    const validator = this.contentValidators.get(validated.kind);
    if (validator) {
      validator.validateContent(validated.content);
    }

    const entry: TypedContributionEntry = {
      kind: validated.kind,
      contribution: validated,
    };
    this.entries.set(validated.id, entry);
    return validated;
  }

  /** Récupère une entrée typée par identifiant. */
  get(id: string): TypedContributionEntry | undefined {
    return this.entries.get(id);
  }

  /** Récupère uniquement la contribution brute par identifiant. */
  getContribution(id: string): ContributionContract | undefined {
    return this.entries.get(id)?.contribution;
  }

  /** Indique si un identifiant est enregistré. */
  has(id: string): boolean {
    return this.entries.has(id);
  }

  /** Toutes les contributions enregistrées (ordre d'insertion). */
  getAll(): TypedContributionEntry[] {
    return Array.from(this.entries.values());
  }

  /** Toutes les contributions d'un kind donné. */
  getByKind(kind: ExperienceKind): TypedContributionEntry[] {
    return this.getAll().filter((e) => e.kind === kind);
  }

  /** Nombre de contributions enregistrées. */
  size(): number {
    return this.entries.size;
  }

  /** Vide le registre. Utile pour les tests. */
  clear(): void {
    this.entries.clear();
  }
}

/** Instance par défaut du registre. */
export const contributionRegistry = new ContributionRegistry(contentValidators);
