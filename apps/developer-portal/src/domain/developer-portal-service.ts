/**
 * @ijideals/developer-portal — Domain service.
 *
 * Règles métier du catalogue : validation des projections, unicité par
 * ressource source, et lecture filtrée. Aucune dépendance framework.
 */

import type { CatalogEntry, CatalogEntryType } from "./catalog-entry.js";
import { isCatalogEntryType } from "./catalog-entry.js";
import type { CatalogQuery, CatalogRepository } from "./catalog-repository.js";
import {
  CatalogEntryNotFoundError,
  InvalidCatalogEntryError,
} from "./developer-portal-errors.js";

export interface CatalogEntryInput {
  sourceId: string;
  name: string;
  type: string;
  version: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface CatalogProjectionUpdate extends CatalogEntryInput {
  /** Identifiant de projection ; généré si absent. */
  id?: string;
}

const SEMVER_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

export class DeveloperPortalService {
  constructor(private readonly catalog: CatalogRepository) {}

  async listCatalog(query?: CatalogQuery): Promise<CatalogEntry[]> {
    return this.catalog.findAll(query);
  }

  async getEntry(id: string): Promise<CatalogEntry> {
    const entry = await this.catalog.findById(id);
    if (!entry) throw new CatalogEntryNotFoundError(id);
    return entry;
  }

  async getBySourceId(sourceId: string): Promise<CatalogEntry> {
    const entry = await this.catalog.findBySourceId(sourceId);
    if (!entry) throw new CatalogEntryNotFoundError(sourceId);
    return entry;
  }

  /**
   * Crée ou met à jour la projection d'une ressource.
   * Idempotent par `sourceId` : la ressource source reste souveraine.
   */
  async projectResource(input: CatalogProjectionUpdate): Promise<CatalogEntry> {
    this.assertValid(input);

    const existing = await this.catalog.findBySourceId(input.sourceId);
    const entry: CatalogEntry = {
      id: input.id ?? existing?.id ?? input.sourceId,
      sourceId: input.sourceId,
      name: input.name,
      type: input.type as CatalogEntryType,
      version: input.version,
      description: input.description ?? "",
      metadata: { ...(existing?.metadata ?? {}), ...(input.metadata ?? {}) },
    };

    return this.catalog.save(entry);
  }

  async removeEntry(id: string): Promise<void> {
    const deleted = await this.catalog.delete(id);
    if (!deleted) throw new CatalogEntryNotFoundError(id);
  }

  private assertValid(input: CatalogProjectionUpdate): void {
    if (!input.sourceId?.trim()) {
      throw new InvalidCatalogEntryError("sourceId is required");
    }
    if (!input.name?.trim()) {
      throw new InvalidCatalogEntryError("name is required");
    }
    if (!isCatalogEntryType(input.type)) {
      throw new InvalidCatalogEntryError(`unknown type "${input.type}"`);
    }
    if (!SEMVER_RE.test(input.version)) {
      throw new InvalidCatalogEntryError(
        `version must be semver, got "${input.version}"`,
      );
    }
  }
}
