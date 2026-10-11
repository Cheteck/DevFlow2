/**
 * @apps/spaces — Composition Root (descriptor wiring).
 *
 * Public composition contract for the Spaces BAC: the ONLY module outside
 * this BAC allowed to know how its descriptor is assembled (domain service
 * + Postgres repository + presentation). Server code (`src/server/…`) must
 * import this file — never `domain/…`, `infrastructure/…` or
 * `presentation/…` directly.
 *
 * Two factories:
 * - `createSpacesWiredDescriptor(db)` — production path (Postgres-backed).
 * - `createSpacesFallbackDescriptor()` — honest empty states (in-memory),
 *   used when the database wiring is unavailable. Never blocks boot.
 */

import type { BacDescriptor } from "@mosaix/contracts";
import type { DatabasePort } from "@mosaix/ports-database";
import { SpaceService } from "./domain/space.model.js";
import { PostgresSpaceRepository } from "./infrastructure/postgres-space-repository.js";
import { createSpacesDescriptor } from "./presentation/spaces-view.js";

export function createSpacesWiredDescriptor(db: DatabasePort): BacDescriptor {
  const spaceService = new SpaceService(new PostgresSpaceRepository(db));
  return createSpacesDescriptor({ spaceService });
}

export function createSpacesFallbackDescriptor(): BacDescriptor {
  return createSpacesDescriptor();
}
