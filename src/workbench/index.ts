/**
 * @mosaix/workbench — Public Entry Point
 *
 * MosaiX Workbench : infrastructure d'interface autonome, générique,
 * dynamique et indépendante des projets consommateurs.
 *
 * Le cœur du Workbench est indépendant du DOM, des BAC métier et des
 * détails propres à IJideals. Il consomme les contrats de @mosaix/contracts
 * et expose une API de configuration, d'enregistrement de contributions et
 * de résolution.
 *
 * Frontières architecturales :
 * - Aucun import vers src/shell/, apps/ ou @mosaix/core depuis le cœur.
 * - Le Runtime MosaiX est consommé via un adaptateur (hors périmètre Phase 1).
 * - L'entrée publique n'impose aucune dépendance directe au Runtime.
 *
 * Périmètre Phase 1 (fondation) :
 * - configuration typée et validée (WorkbenchConfiguration) ;
 * - contexte de travail (WorkspaceContext) ;
 * - enregistrement et résolution de contributions (ContributionContract) ;
 * - tests sans DOM ;
 * - indépendance démontrée vis-à-vis de src/shell/.
 *
 * Le Layout Engine, le Navigation Engine, le rendu DOM/SSR et
 * l'intégration IJideals ne font pas partie de ce périmètre.
 */

export type {
  WorkbenchConfiguration,
  WorkbenchBranding,
  WorkbenchRegion,
  WorkbenchLayoutRef,
  WorkbenchPreset,
  WorkbenchUICapabilities,
} from "@mosaix/workbench/core/contracts/workbench-configuration.js";
export { MINIMAL_WORKBENCH_CONFIG } from "@mosaix/workbench/core/contracts/workbench-configuration.js";

export type { WorkspaceContext, NO_ACTIVE_WORKSPACE } from "@mosaix/workbench/context/workspace-context.js";

export type {
  WorkbenchConfigLoader,
  WorkbenchConfigResult,
  WorkbenchConfigValidationError,
} from "@mosaix/workbench/core/configuration/workbench-config-loader.js";
export {
  validateWorkbenchConfiguration,
  DefaultWorkbenchConfigLoader,
} from "@mosaix/workbench/core/configuration/workbench-config-loader.js";

export type {
  ContributionRegistry,
  TypedContributionEntry,
} from "@mosaix/workbench/core/contributions/contribution-registry.js";
export type { ContributionRegistryError } from "@mosaix/workbench/core/contributions/errors.js";
export {
  contributionRegistry,
} from "@mosaix/workbench/core/contributions/contribution-registry.js";

export type {
  ResolvedContribution,
  ContributionResolverOptions,
} from "@mosaix/workbench/core/contributions/contribution-resolver.js";
export {
  resolveContributions,
} from "@mosaix/workbench/core/contributions/contribution-resolver.js";

export type { ContentValidator } from "@mosaix/workbench/core/contributions/contribution-validator.js";
export type { ContributionValidationError } from "@mosaix/workbench/core/contributions/errors.js";
export {
  validateContributionEnvelope,
  validatePlacements,
  contentValidators,
} from "@mosaix/workbench/core/contributions/contribution-validator.js";

// ─── Layout Engine (Phase 2) ────────────────────────────────────────────────

export type {
  ResolvedLayout,
  ResolvedRegion,
  ResolvedPlacement,
} from "@mosaix/workbench/layout/engine/resolved-layout.js";
export type { LayoutEngine, LayoutEngineOptions } from "@mosaix/workbench/layout/engine/layout-engine.js";

// ─── Navigation Engine (Phase 3) ────────────────────────────────────────────

export type {
  ResolvedNavigationItem,
} from "@mosaix/workbench/navigation/engine/resolved-navigation.js";
export type {
  NavigationEngine,
  NavigationEngineOptions,
} from "@mosaix/workbench/navigation/engine/navigation-engine.js";
export { createNavigationEngine } from "@mosaix/workbench/navigation/engine/navigation-engine.js";

// ─── Runtime Adapter Port (Phase 3) ─────────────────────────────────────────

export type {
  RuntimeAdapterPort,
  BacNavigationEntry,
} from "@mosaix/workbench/adapters/runtime/runtime-port.js";
