import nodemailer from "nodemailer";
import type { EmailPort, EmailMessage, EmailResult } from "@mosaix/ports-email";

export interface SmtpEmailAdapterOptions {
  /** Explicitly opt into nodemailer's `jsonTransport` mock (captures messages, never sends). */
  mock?: boolean;
  /** SMTP host. */
  host?: string;
  /** SMTP port. */
  port?: number;
  /** Whether to use a secure connection (TLS). */
  secure?: boolean;
  /** Well-known service name (e.g. "gmail", "mailtrap"). */
  service?: string;
  /** SMTP endpoint URL (nodemailer supports connection URLs). */
  url?: string;
  /** SMTP authentication. */
  auth?: { user: string; pass: string };
  /** Additional nodemailer transport options forwarded to `createTransport`. */
  [key: string]: unknown;
}

export class SmtpEmailAdapter implements EmailPort {
  private readonly transporter: nodemailer.Transporter;

  constructor(
    transporterOrOptions?: nodemailer.Transporter | SmtpEmailAdapterOptions,
  ) {
    if (
      transporterOrOptions &&
      typeof transporterOrOptions === "object" &&
      typeof (transporterOrOptions as { sendMail?: unknown }).sendMail ===
        "function"
    ) {
      this.transporter = transporterOrOptions as nodemailer.Transporter;
      return;
    }

    const options: SmtpEmailAdapterOptions =
      (transporterOrOptions as SmtpEmailAdapterOptions | undefined) ?? {};

    if (options.mock === true) {
      // Explicit mock mode: nodemailer jsonTransport captures the message
      // envelope without ever contacting an SMTP server.
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      return;
    }

    const { mock: _mock, ...smtp } = options;
    if (Object.keys(smtp).length === 0) {
      throw new Error(
        "SmtpEmailAdapter: missing SMTP configuration. Provide a transporter instance, an SMTP transport configuration, or `{ mock: true }` to explicitly opt into the mock transport.",
      );
    }
    this.transporter = nodemailer.createTransport(smtp);
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    const mailOptions: nodemailer.SendMailOptions = {
      from: message.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    };

    if (message.cc !== undefined) mailOptions.cc = message.cc;
    if (message.bcc !== undefined) mailOptions.bcc = message.bcc;

    const info = await this.transporter.sendMail(mailOptions);
    return {
      messageId: info.messageId || `smtp-${Date.now()}-${Math.random()}`,
    };
  }
}
