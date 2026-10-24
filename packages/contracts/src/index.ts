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

export { CONTRACT_VERSION } from "./version.js";

// ─── Artifact root ─────────────────────────────────────────────
export type {
  MosaixArtifactManifest,
  MosaixArtifactType,
  ArtifactMetadata,
  ArtifactDependency,
} from "./mosaix-artifact.js";

// ─── Application ───────────────────────────────────────────────
export type {
  ApplicationManifest,
  ApplicationDomain,
  ApplicationRuntime,
} from "./application/application-manifest.js";
export type {
  AppStatus,
  ApplicationLifecycleContract,
} from "./application/application-lifecycle.js";
export type { ApplicationPermissions } from "./application/application-permissions.js";
export type { ApplicationExperienceContract } from "./application/application-experience.js";

// ─── Plugin ────────────────────────────────────────────────────
export type { PluginManifest, SlotContribution, PluginPermission, PluginHookDeclaration, PluginSettingsSchema, PluginPublisher } from "./plugin/plugin-manifest.js";
export type { PluginLifecycleContract } from "./plugin/plugin-lifecycle.js";
export type { PluginPermissions } from "./plugin/plugin-permissions.js";
export { PLUGIN_EXTENSION_POINTS } from "./plugin/plugin-extension.js";
export type {
  PluginExtensionContract,
  PluginExtensionPoint,
} from "./plugin/plugin-extension.js";

// ─── Capability ────────────────────────────────────────────────
export type {
  CapabilityContract,
  CapabilityOperation,
} from "./capability/capability-contract.js";
export type { CapabilityProvider } from "./capability/capability-provider.js";
export type { CapabilityConsumer } from "./capability/capability-consumer.js";

// ─── Experience ────────────────────────────────────────────────
export * from "./experience/index.js";

// ─── Theme ─────────────────────────────────────────────────────
export type { ThemeManifest } from "./theme/theme-manifest.js";
export type {
  DesignTokens,
  ColorTokens,
  TypographyTokens,
  SpacingTokens,
  RadiusTokens,
  ShadowTokens,
  MotionTokens,
} from "./theme/design-tokens.js";
export type { ThemeAssets, BrandingProfile } from "./theme/branding.js";
export type { AccessibilityProfile } from "./theme/accessibility.js";
export type { ThemeTarget } from "./theme/theme-target.js";
export type {
  AssignmentSource,
  ThemeAssignment,
} from "./theme/theme-assignment.js";
export type { ThemeAssignmentsStore } from "./theme/theme-assignments-store.js";
// Legacy consumers of the old bag shape: use ExperienceThemePreference (D-02).
export type { ThemePreference } from "./theme/theme-preference.js";
export type { ThemeMode } from "./theme/theme-mode.js";
export type {
  ThemeResolutionSource,
  ThemeResolution,
  ThemeResolutionContext,
} from "./theme/theme-resolution.js";
export type { ResolvedTheme, CompiledTheme } from "./theme/theme-resolved.js";
export {
  themeAssignmentChangedEvent,
  themeChangedEvent,
} from "./theme/theme-events.js";
export type {
  ThemeAssignmentChangedEvent,
  ThemeAssignmentChangedPayload,
  ThemeChangedEvent,
  ThemeChangedPayload,
} from "./theme/theme-events.js";

// ─── Events ────────────────────────────────────────────────────
export type {
  MosaixEventEnvelope,
  EventSource,
  EventMetadata,
  EventSecurity,
  EventClassification,
  TenantIdentity,
} from "./events/event-contract.js";
export type { CommandContract } from "./events/command-contract.js";
export type { QueryContract } from "./events/query-contract.js";
export type {
  FeedPostCreatedPayload,
  FeedReactionToggledPayload,
  FeedCommentAddedPayload,
  FeedPostCreatedEvent,
  FeedReactionToggledEvent,
  FeedCommentAddedEvent,
} from "./events/feed-events.js";

// ─── Security ──────────────────────────────────────────────────
export type {
  PermissionContract,
  PermissionScope,
  PermissionCategory,
} from "./security/permission-contract.js";
export {
  TrustLevels,
  type TrustLevel,
  type TrustLevelContract,
} from "./security/trust-level.js";
export type {
  ArtifactSignature,
  SignatureAlgorithm,
} from "./security/signature.js";

// ─── Authentication ──────────────────────────────────────────────
export type { AuthenticationMethod } from "./auth/authentication-method.js";
export type {
  AuthenticationContext,
  AuthenticationFactor,
} from "./auth/authentication-context.js";
export type { AuthenticatedPrincipal } from "./auth/authenticated-principal.js";
export type { AuthenticationRequest } from "./auth/authentication-request.js";
export type {
  AuthenticationResult,
  AuthRedirect,
  AuthChallenge,
  AuthError,
} from "./auth/authentication-result.js";
export type {
  Identity,
  ExternalIdentity,
  LinkExternalIdentityInput,
} from "./auth/identity.js";
export type { Session } from "./auth/session.js";
export type {
  Credential,
  CredentialType,
  SaveCredentialInput,
} from "./auth/credential.js";
export type {
  AuthenticationProvider,
  VerificationRequest,
  VerificationResult,
  LogoutContext,
  RefreshContext,
  TokenType,
  TokenResult,
} from "./auth/provider.js";
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
} from "./auth/auth-events.js";

// Re-export Phase 0.1 Primitive Contracts
export * from "./platform.js";
export * from "./runtime.js";
export * from "./session.js";
export * from "./route.js";
export * from "./experience/index.js";
export * from "./openapi-contract-generator.js";

export type * from "./application/application-definition.js";

