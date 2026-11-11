/**
 * OtpRateLimiterPort — Rate limiting pour les demandes OTP.
 *
 * Le ``scope`` combine tenantId + destination + purpose pour isoler
 * les compteurs par utilisateur et par finalité.
 *
 * Réservation atomique : `reserveSlot()` retourne true si un quota est disponible
 * et le décrémente atomiquement (évite la course condition entre canRequest/recordRequest).
 */
export interface OtpRateLimiterPort {
  /**
   * Vérifie si une nouvelle demande OTP est autorisée.
   * Retourne ``true`` si OK, ``false`` si limite dépassée.
   * @deprecated Utiliser `reserveSlot()` pour une réservation atomique.
   */
  canRequest(scope: string): Promise<boolean>;

  /** Enregistre une demande OTP réussie. */
  recordRequest(scope: string): Promise<void>;

  /**
   * Réserve atomiquement un slot de quota. Retourne ``true`` si réservé,
   * ``false`` si limite atteinte. À appeler AVANT de générer le code OTP.
   */
  reserveSlot(scope: string): Promise<boolean>;

  /**
   * Compense une réservation annulée (ex: échec livraison).
   * Réincrémente le compteur de demandes.
   */
  releaseSlot(scope: string): Promise<void>;

  /**
   * Vérifie si un re-envoi OTP est autorisé (cooldown).
   * Retourne ``true`` si OK, ``false`` si cooldown en cours.
   */
  canResend(scope: string): Promise<boolean>;

  /** Enregistre un re-envoi OTP. */
  recordResend(scope: string): Promise<void>;
}