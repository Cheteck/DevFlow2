/**
 * Widget contract — a composable UI unit bound to a capability.
 */

export interface WidgetContract {
  id: string;
  title?: string;
  /** Id of the capability backing this widget. */
  capabilityId?: string;
  /** Required permissions to render (optional). */
  requiresPermission?: string;
}
