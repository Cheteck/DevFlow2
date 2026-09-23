/**
 * Trust level — how much the ecosystem trusts an artifact.
 */

export type TrustLevel = 1 | 2 | 3 | 4 | 5;

export const TrustLevels = {
  /** Community sandbox — fully isolated, permission-gated. */
  COMMUNITY_SANDBOX: 1,
  /** Community with basic review. */
  COMMUNITY: 2,
  /** Verified enterprise partner — scoped. */
  VERIFIED_PARTNER: 3,
  /** Strategic partner — broader scope. */
  STRATEGIC_PARTNER: 4,
  /** Official platform artifact — unrestricted. */
  OFFICIAL_PLATFORM: 5,
} as const;

export interface TrustLevelContract {
  level: TrustLevel;
  label: string;
  /** Isolation policy applied at runtime. */
  scope: "sandbox" | "scoped" | "unrestricted";
  /** Whether a valid signature is mandatory. */
  requiresSignature: boolean;
}
