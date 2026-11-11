import type { OtpChannel } from "../domain/otp-channel.js";

export interface OtpDeliveryResult {
  messageId: string;
}

export interface OtpDeliveryCommand {
  readonly destination: string;
  readonly channel: OtpChannel;
  readonly message: string;
}

/**
 * OtpDeliveryPort — Abstraction pour l'envoi d'OTP via différents canaux.
 * Les adapters concrets routent vers EmailPort, SmsPort ou WhatsAppPort.
 */
export interface OtpDeliveryPort {
  send(command: OtpDeliveryCommand): Promise<OtpDeliveryResult>;
}