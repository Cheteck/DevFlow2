/**
 * @mosaix/core — Plugin Lifecycle Manager (Phase 10)
 */

export type PluginLifecycleState =
  | "DISCOVERED"
  | "VALIDATED"
  | "LOADED"
  | "INITIALIZED"
  | "ACTIVE"
  | "STOPPED";

export class PluginLifecycleManager {
  private state: PluginLifecycleState = "DISCOVERED";

  get currentState(): PluginLifecycleState {
    return this.state;
  }

  validate(): void {
    if (this.state === "DISCOVERED") {
      this.state = "VALIDATED";
    }
  }

  load(): void {
    if (this.state === "VALIDATED") {
      this.state = "LOADED";
    }
  }

  async initialize(): Promise<void> {
    if (this.state === "LOADED") {
      this.state = "INITIALIZED";
    }
  }

  async activate(): Promise<void> {
    if (this.state === "INITIALIZED") {
      this.state = "ACTIVE";
    }
  }

  async deactivate(): Promise<void> {
    this.state = "STOPPED";
  }
}
