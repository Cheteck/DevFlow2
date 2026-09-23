/**
 * Application lifecycle — states supervised by the Runtime Kernel.
 */

import type { AppStatus } from "@mosaix/types";

export type { AppStatus };

export interface ApplicationLifecycleContract {
  status: AppStatus;
  /** Transition is governed by the kernel; invalid transitions are rejected. */
  transition(to: AppStatus, reason?: string): Promise<void>;
}
