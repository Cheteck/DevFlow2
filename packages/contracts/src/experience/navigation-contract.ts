/**
 * Navigation contract — declarative navigation items of an application.
 */

export interface NavigationItem {
  id: string;
  label: string;
  icon?: string;
  /** Route or capability reference the item triggers. */
  target: string;
  order: number;
  requiresPermission?: string;
}

export interface NavigationContract {
  items: NavigationItem[];
}
