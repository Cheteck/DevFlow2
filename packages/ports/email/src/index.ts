export interface EmailMessage {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface EmailResult {
  messageId: string;
}

/**
 * EmailPort — Decouples application emails dispatch from nodemailer, AWS SES or other clients.
 */
export interface EmailPort {
  /** Asynchronously dispatches an email message. */
  send(message: EmailMessage): Promise<EmailResult>;
}
