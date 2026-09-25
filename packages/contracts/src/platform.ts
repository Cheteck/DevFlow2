/**
 * Canonical Platform Primitive Contract (Phase 0.1)
 */

export interface PlatformConfig {
  id: string;
  name: string;
  version: string;
  environment: "development" | "staging" | "production" | "test";
  metadata?: Record<string, unknown>;
}

export interface PlatformInstance {
  readonly config: PlatformConfig;
  readonly startedAt: string;
  readonly status: "starting" | "active" | "degraded" | "stopping" | "stopped";
}

/**
 * Platform Governance Settings (PRD-Shell-P1)
 * Controls default application routing and runtime platform defaults.
 */
export interface PlatformSettings {
  /** Identifier of the default BAC to mount on the root route '/' (e.g. 'solara') */
  defaultBacId: string;
  /** Identifier of fallback BAC if default BAC is unavailable or unauthorized */
  fallbackBacId: string;
  /** Display name of the platform instance */
  platformName: string;
  /** Whether platform maintenance mode is enabled */
  maintenanceMode: boolean;
  /** Roles allowed during maintenance */
  allowedRolesInMaintenance: string[];
  /** Strategy for unauthenticated visitors */
  unauthenticatedStrategy: "redirect_login" | "render_public_landing" | "render_auth_bac";
  /** Auth BAC ID for login rendering */
  authBacId: string;
  /** Custom settings bag for plugins / extensions */
  metadata?: Record<string, unknown>;
}

/**
 * Execution context supplied by the Shell orchestrator to a mounted BAC
 */
export interface BacExecutionContext {
  tenantId: string;
  spaceId: string | null;
  user: {
    id: string;
    email?: string;
    roles: string[];
    permissions: string[];
  };
  theme: {
    mode: "light" | "dark" | "high-contrast";
    tokens?: Record<string, string>;
  };
  request: {
    path: string;
    query: Record<string, string>;
    headers: Record<string, string>;
  };
}

/**
 * Output of a BAC render pass consumed by the Shell
 */
export interface BacRenderResult {
  /** Main HTML body rendered in the workspace viewport */
  contentHtml: string;
  /** Optional custom page title for HTML <title> */
  pageTitle?: string;
  /** Optional custom contextual actions for the secondary sidebar */
  contextualSidebarHtml?: string;
  /** Optional custom head tags (meta, scripts, stylesheets) */
  headerHeadTags?: string;
}

/**
 * Contract implemented by Bounded Application Components (BACs)
 * for dynamic discovery, health checking, and rendering by the Shell.
 */
export interface BacDescriptor {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly routePrefix: string;
  readonly icon: string;
  readonly isEnabled: boolean;
  readonly requiredPermissions?: string[];

  /**
   * Health and readiness probe for the BAC
   */
  isAvailable(): Promise<boolean>;

  /**
   * SSR render entry point invoked by the Shell
   */
  render(context: BacExecutionContext): Promise<BacRenderResult>;
}

