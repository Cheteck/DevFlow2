/**
 * @ijideals/developer-portal — Domain errors.
 */

export class DeveloperPortalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class CatalogEntryNotFoundError extends DeveloperPortalError {
  constructor(id: string) {
    super(`Catalog entry not found: ${id}`);
  }
}

export class DuplicateCatalogSourceError extends DeveloperPortalError {
  constructor(sourceId: string) {
    super(`A catalog projection already exists for source: ${sourceId}`);
  }
}

export class InvalidCatalogEntryError extends DeveloperPortalError {
  constructor(message: string) {
    super(`Invalid catalog entry: ${message}`);
  }
}
