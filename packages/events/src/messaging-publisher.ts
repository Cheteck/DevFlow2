/**
 * @mosaix/events — Message bus driver resolution (Phase 21).
 *
 * Pure env parsing with no adapter dependencies (keeps @mosaix/events
 * decoupled from concrete brokers). The concrete publisher factory lives in
 * the platform composition root (`src/outbox-messaging-publisher.ts`) which
 * may depend on `@mosaix/adapter-*`.
 */

export type MessageBusDriver = "kafka" | "rabbitmq" | "memory";

export function resolveMessageBusDriver(env: NodeJS.ProcessEnv = process.env): MessageBusDriver {
  const raw = env.MESSAGE_BUS_DRIVER?.toLowerCase();
  if (raw === "kafka") return "kafka";
  if (raw === "rabbitmq" || raw === "rabbit" || raw === "amqp") return "rabbitmq";
  return "memory";
}
