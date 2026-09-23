/**
 * @mosaix/listener — Typed Listener Base Interface
 */

import type { MosaixEventEnvelope } from "@mosaix/contracts";

export interface MosaixEventListener<T = unknown> {
  onEvent(event: MosaixEventEnvelope<T>): Promise<void> | void;
}
