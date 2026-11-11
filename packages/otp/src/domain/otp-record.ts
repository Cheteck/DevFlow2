import type { OtpChannel } from "./otp-channel.js";
import type { OtpPurpose } from "./otp-purpose.js";

export interface OtpRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly destination: string;
  readonly channel: OtpChannel;
  readonly purpose: OtpPurpose;
  readonly userId?: string;
  readonly codeHash: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly consumedAt?: number;
  readonly attempts: number;
  readonly maxAttempts: number;
}