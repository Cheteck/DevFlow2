/**
 * @ijideals/developer-portal — Port sortant : projection du catalogue.
 *
 * Le portail est propriétaire de cette projection, jamais des registres
 * sources (BAC / packages).
 */

import type { CatalogEntry, CatalogEntryType } from "./catalog-entry.js";

export interface CatalogQuery {
  type?: CatalogEntryType;
  /** Recherche libre sur le nom et la description. */
  text?: string;
}

export interface CatalogRepository {
  findAll(query?: CatalogQuery): Promise<CatalogEntry[]>;
  findById(id: string): Promise<CatalogEntry | undefined>;
  findBySourceId(sourceId: string): Promise<CatalogEntry | undefined>;
  save(entry: CatalogEntry): Promise<CatalogEntry>;
  delete(id: string): Promise<boolean>;
}
