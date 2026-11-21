/**
 * @mosaix/workbench — Erreurs du système de contributions
 *
 * Regroupe les erreurs levées par le registre et les validateurs afin
 * d'éviter toute dépendance circulaire entre ces deux modules.
 */

/** Erreur levée quand une contribution ne peut pas être enregistrée. */
export class ContributionRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContributionRegistryError";
  }
}

/** Erreur de validation d'une contribution. */
export class ContributionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContributionValidationError";
  }
}
