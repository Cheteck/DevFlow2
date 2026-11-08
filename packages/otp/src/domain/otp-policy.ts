export interface OtpPolicy {
  /** Nombre de chiffres du code (défaut: 6). */
  readonly codeLength: number;
  /** Durée de validité en secondes (défaut: 300). */
  readonly ttlSeconds: number;
  /** Nombre maximum de tentatives de vérification (défaut: 5). */
  readonly maxAttempts: number;
  /** Cooldown entre deux envois en secondes (défaut: 60). */
  readonly resendCooldownSeconds: number;
  /** Nombre maximum de demandes par heure et par destination/purpose (défaut: 5). */
  readonly maxRequestsPerHour: number;
}

export const DEFAULT_OTP_POLICY: OtpPolicy = {
  codeLength: 6,
  ttlSeconds: 300,
  maxAttempts: 5,
  resendCooldownSeconds: 60,
  maxRequestsPerHour: 5,
};