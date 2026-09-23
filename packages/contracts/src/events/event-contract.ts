/**
 * Event contract — the canonical domain event surface.
 *
 * The envelope is the single standardized wrapper for every domain event.
 * It is reused from `@mosaix/types` (the foundation layer) so there is a
 * single source of truth for the envelope shape.
 */

export type {
  MosaixEventEnvelope,
  EventSource,
  EventMetadata,
  EventSecurity,
  EventClassification,
  TenantIdentity,
} from "@mosaix/types";
