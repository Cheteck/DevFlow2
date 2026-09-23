/**
 * Plugin extension contract — where and how a plugin attaches.
 */

/**
 * Known built-in extension points (legacy closed list). Kept for discovery
 * and IDE autocomplete; the `PluginExtensionPoint` type itself is OPEN (any
 * string identifier is valid, T-EXT-04).
 */
export const PLUGIN_EXTENSION_POINTS = [
  "navigation",
  "dashboard",
  "workflow",
  "domain",
  "toolbar",
  "command",
] as const;

/**
 * Extension point on the target artifact. Open by design (T-EXT-04): the
 * legacy union is retained for documentation/autocomplete, but any string is a
 * valid identifier. Targeting an unknown point at runtime yields `undefined`,
 * never an error (theme-target D-17 analogy).
 */
export type PluginExtensionPoint =
  (typeof PLUGIN_EXTENSION_POINTS)[number] | (string & {});

export interface PluginExtensionContract {
  /** Id of the target artifact being extended. */
  target: string;
  point: PluginExtensionPoint | PluginExtensionPoint[];
  /** Declared hook identifiers the plugin provides to the target. */
  hooks?: string[];
}
