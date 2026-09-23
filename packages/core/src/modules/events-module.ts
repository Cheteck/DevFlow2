/**
 * @mosaix/core — Events module
 *
 * Provides the event store, the event bus and the event schema registry.
 * The schema validation uses @mosaix/schemas (structural) then the schema
 * registry (ownership, single-owner rule).
 */

import { MosaixEventEnvelopeSchema } from "@mosaix/schemas";

import { DomainEventBus, EventStore } from "../event-bus";
import { EventSchemaRegistry } from "../event-schema-registry";
import type { KernelContext, KernelModule } from "../kernel-module";

export class EventsModule implements KernelModule {
  readonly name = "events";
  readonly version = "2.0.0";

  register(ctx: KernelContext): void {
    const store = new EventStore();
    const schemas = new EventSchemaRegistry();
    const bus = new DomainEventBus(
      store,
      (permission, tenant, app) =>
        ctx.permissions.check(permission, tenant, app),
      (envelope) => {
        if (!MosaixEventEnvelopeSchema.safeParse(envelope).success) {
          return false;
        }
        return schemas.validateEnvelope(envelope);
      },
      (envelope) => schemas.validatePayload(envelope),
    );
    ctx.setService("eventStore", store);
    ctx.setService("eventSchemas", schemas);
    ctx.setService("events", bus);
  }
}
