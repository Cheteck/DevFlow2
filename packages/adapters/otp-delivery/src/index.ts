import type { OtpDeliveryPort, OtpDeliveryCommand, OtpDeliveryResult } from "@mosaix/otp";
import type { EmailPort } from "@mosaix/ports-email";
import type { SmsPort } from "@mosaix/ports-sms";
import type { WhatsAppPort } from "@mosaix/ports-whatsapp";

export interface OtpDeliveryDispatcherOptions {
  readonly emailFrom?: string;
  readonly emailSubject?: string;
  readonly whatsappTemplate?: string;
}

/**
 * OtpDeliveryDispatcher — routes an OTP command to the right channel port.
 *
 * Extensible: a plugin-style registry could replace the switch, but for
 * the 3 known channels (email / sms / whatsapp) the switch is sufficient.
 *
 * Errors are propagated: the caller (OtpService) is responsible for
 * compensating (invalidateById + releaseSlot) on failure.
 */
export class OtpDeliveryDispatcher implements OtpDeliveryPort {
  constructor(
    private readonly email: EmailPort,
    private readonly sms: SmsPort,
    private readonly whatsapp: WhatsAppPort,
    private readonly options: OtpDeliveryDispatcherOptions = {},
  ) {}

  async send(command: OtpDeliveryCommand): Promise<OtpDeliveryResult> {
    switch (command.channel) {
      case "email": {
        const result = await this.email.send({
          from: this.options.emailFrom ?? "no-reply@mosaix.local",
          to: command.destination,
          subject: this.options.emailSubject ?? "Your verification code",
          text: command.message,
        });
        return { messageId: result.messageId };
      }
      case "sms": {
        const result = await this.sms.send({
          to: command.destination,
          message: command.message,
        });
        return { messageId: result.messageId };
      }
      case "whatsapp": {
        const result = await this.whatsapp.send({
          to: command.destination,
          message: command.message,
          template: this.options.whatsappTemplate,
        });
        return { messageId: result.messageId };
      }
      default:
        // Exhaustiveness check: impossible with the OtpChannel union, but
        // we never throw here silently — reject unknown channels explicitly.
        throw new Error(`OtpDeliveryDispatcher: unsupported channel "${String(command.channel)}"`);
    }
  }
}
