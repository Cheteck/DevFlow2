/**
 * @apps/citadelle — In-Memory OtpDeliveryPort
 *
 * Temporary in-memory implementation. Logs the OTP code instead of sending
 * via SMS/email/WhatsApp. Production should use @mosaix/adapter-otp-delivery
 * with real email/SMS/WhatsApp ports.
 */

import type {
  OtpDeliveryPort,
  OtpDeliveryCommand,
  OtpDeliveryResult,
} from "@mosaix/otp";

export class InMemoryOtpDelivery implements OtpDeliveryPort {
  private delivered: OtpDeliveryCommand[] = [];

  async send(command: OtpDeliveryCommand): Promise<OtpDeliveryResult> {
    this.delivered.push(command);
    // Log the code for development (never in production)
    if (process.env.DEBUG) {
      console.log(`[OTP DELIVERY] ${command.channel} → ${command.destination}: ${command.message}`);
    }
    return { messageId: `otp_${Date.now()}_${Math.random().toString(36).slice(2)}` };
  }

  /** Get all delivered messages (for testing) */
  getDelivered(): OtpDeliveryCommand[] {
    return [...this.delivered];
  }

  /** Get the last delivered code for a destination */
  getLastCodeFor(destination: string): string | null {
    for (let i = this.delivered.length - 1; i >= 0; i--) {
      if (this.delivered[i].destination === destination) {
        // Extract code from message "Your verification code is XXXXXX"
        const match = this.delivered[i].message.match(/code is (\d+)/);
        return match ? match[1] : null;
      }
    }
    return null;
  }
}
