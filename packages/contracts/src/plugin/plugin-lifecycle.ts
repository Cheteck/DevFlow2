/**
 * Plugin lifecycle — a plugin is activated/deactivated within its target.
 */

export interface PluginLifecycleContract {
  activate(): Promise<void> | void;
  deactivate(): Promise<void> | void;
}
