/**
 * @mosaix/contracts
 * MosaiX Domain Contract Layer — canonical contracts for the ecosystem.
 *
 * This package is the stable boundary between Runtime, Applications, Plugins,
 * and Control tooling. It declares WHAT can be registered, loaded, executed,
 * and governed. It contains NO business logic, NO runtime code, NO network
 * access, and NO UI dependencies.
 *
 * Analogous to an OCI specification layer for containers: it does not run
 * anything, it defines what lets the whole ecosystem interoperate.
 *
 * Dependency direction: contracts → types (downward only).
 * Consumers: core, sdk, apps, adapters, cli, control-plane.
 */

export { CONTRACT_VERSION } from "./version";

// ─── Artifact root ─────────────────────────────────────────────
export type {
  MosaixArtifactManifest,
  MosaixArtifactType,
  ArtifactMetadata,
  ArtifactDependency,
} from "./mosaix-artifact";

// ─── Application ───────────────────────────────────────────────
export type {
  ApplicationManifest,
  ApplicationDomain,
  ApplicationRuntime,
} from "./application/application-manifest";
export type {
  AppStatus,
  ApplicationLifecycleContract,
} from "./application/application-lifecycle";
export type { ApplicationPermissions } from "./application/application-permissions";
export type { ApplicationExperienceContract } from "./application/application-experience";

// ─── Plugin ────────────────────────────────────────────────────
export type { PluginManifest } from "./plugin/plugin-manifest";
export type { PluginLifecycleContract } from "./plugin/plugin-lifecycle";
export type { PluginPermissions } from "./plugin/plugin-permissions";
export { PLUGIN_EXTENSION_POINTS } from "./plugin/plugin-extension";
export type {
  PluginExtensionContract,
  PluginExtensionPoint,
} from "./plugin/plugin-extension";

// ─── Capability ────────────────────────────────────────────────
export type {
  CapabilityContract,
  CapabilityOperation,
} from "./capability/capability-contract";
export type { CapabilityProvider } from "./capability/capability-provider";
export type { CapabilityConsumer } from "./capability/capability-consumer";

// ─── Experience ────────────────────────────────────────────────
export * from "./experience";

// ─── Theme ─────────────────────────────────────────────────────
export type { ThemeManifest } from "./theme/theme-manifest";
export type {
  DesignTokens,
  ColorTokens,
  TypographyTokens,
  SpacingTokens,
  RadiusTokens,
  ShadowTokens,
  MotionTokens,
} from "./theme/design-tokens";
export type { ThemeAssets, BrandingProfile } from "./theme/branding";
export type { AccessibilityProfile } from "./theme/accessibility";
export type { ThemeTarget } from "./theme/theme-target";
export type {
  AssignmentSource,
  ThemeAssignment,
} from "./theme/theme-assignment";
export type { ThemeAssignmentsStore } from "./theme/theme-assignments-store";
// Legacy consumers of the old bag shape: use ExperienceThemePreference (D-02).
export type { ThemePreference } from "./theme/theme-preference";
export type { ThemeMode } from "./theme/theme-mode";
export type {
  ThemeResolutionSource,
  ThemeResolution,
  ThemeResolutionContext,
} from "./theme/theme-resolution";
export type { ResolvedTheme, CompiledTheme } from "./theme/theme-resolved";
export {
  themeAssignmentChangedEvent,
  themeChangedEvent,
} from "./theme/theme-events";
export type {
  ThemeAssignmentChangedEvent,
  ThemeAssignmentChangedPayload,
  ThemeChangedEvent,
  ThemeChangedPayload,
} from "./theme/theme-events";

// ─── Events ────────────────────────────────────────────────────
export type {
  MosaixEventEnvelope,
  EventSource,
  EventMetadata,
  EventSecurity,
  EventClassification,
  TenantIdentity,
} from "./events/event-contract";
export type { CommandContract } from "./events/command-contract";
export type { QueryContract } from "./events/query-contract";

// ─── Security ──────────────────────────────────────────────────
export type {
  PermissionContract,
  PermissionScope,
  PermissionCategory,
} from "./security/permission-contract";
export {
  TrustLevels,
  type TrustLevel,
  type TrustLevelContract,
} from "./security/trust-level";
export type {
  ArtifactSignature,
  SignatureAlgorithm,
} from "./security/signature";

// ─── Authentication ──────────────────────────────────────────────
export type { AuthenticationMethod } from "./auth/authentication-method";
export type {
  AuthenticationContext,
  AuthenticationFactor,
} from "./auth/authentication-context";
export type { AuthenticatedPrincipal } from "./auth/authenticated-principal";
export type { AuthenticationRequest } from "./auth/authentication-request";
export type {
  AuthenticationResult,
  AuthRedirect,
  AuthChallenge,
  AuthError,
} from "./auth/authentication-result";
export type {
  Identity,
  ExternalIdentity,
  LinkExternalIdentityInput,
} from "./auth/identity";
export type { Session } from "./auth/session";
export type {
  Credential,
  CredentialType,
  SaveCredentialInput,
} from "./auth/credential";
export type {
  AuthenticationProvider,
  VerificationRequest,
  VerificationResult,
  LogoutContext,
  RefreshContext,
  TokenType,
  TokenResult,
} from "./auth/provider";
export type {
  AuthEvent,
  AuthEventType,
  AuthenticationSucceededPayload,
  AuthenticationFailedPayload,
  SessionCreatedPayload,
  SessionRevokedPayload,
  IdentityLinkedPayload,
  IdentityUnlinkedPayload,
  PasswordChangedPayload,
  PasswordResetPayload,
  AccountLockedPayload,
  AccountUnlockedPayload,
} from "./auth/auth-events";

// Re-export Phase 0.1 Primitive Contracts
export * from "./platform";
export * from "./runtime";
export * from "./session";
export * from "./route";
export * from "./experience";
export * from "./openapi-contract-generator";

export type * from "./application/application-definition";

