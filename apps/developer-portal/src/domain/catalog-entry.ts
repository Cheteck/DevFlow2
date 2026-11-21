/**
 * @ijideals/developer-portal — Domain entities
 *
 * Projections locales : le portail possède ses métadonnées éditoriales,
 * jamais les registres sources (BAC / packages).
 */

export type CatalogEntryType = "bac" | "app" | "package" | "api";

export interface CatalogEntry {
  /** Identifiant stable de la projection (pas l'identifiant du registre). */
  id: string;
  /** Identifiant de la ressource dans son registre propriétaire. */
  sourceId: string;
  name: string;
  type: CatalogEntryType;
  version: string;
  description: string;
  /** Métadonnées éditoriales propres au portail. */
  metadata: Record<string, unknown>;
}

export function isCatalogEntryType(value: string): value is CatalogEntryType {
  return (
    value === "bac" || value === "app" || value === "package" || value === "api"
  );
}
