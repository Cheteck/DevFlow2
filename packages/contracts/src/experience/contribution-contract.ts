/**
 * @mosaix/contracts — Contribution Contract
 * Intent sémantique (kind, content, policies, placements) sans renderer ni DOM/React.
 */

import type { PlacementContract } from "./placement-contract";

export type ExperienceKind =
  | "navigation"
  | "action"
  | "insight"
  | "badge"
  | "avatar"
  | "section"
  | "widget"
  | "command"
  | "page"
  | "component";

export interface ContributionPolicies {
  requiredPermissions?: string[];
  requiredCapabilities?: string[];
  allowedTenants?: string[];
  supportedDevices?: ("desktop" | "tablet" | "mobile")[];
  routePattern?: string;
  customRule?: string;
}

export interface ContributionContract {
  id: string;
  contractVersion: "1.0.0";
  ownerApp: string;
  kind: ExperienceKind;
  title: string;
  description?: string;
  icon?: string;
  route?: string;
  placements: PlacementContract[];
  policies?: ContributionPolicies;
  metadata?: Record<string, unknown>;
  content?: Record<string, unknown>;
}
