export interface WhatsAppMessage {
  to: string;
  message: string;
  template?: string;
}

export interface WhatsAppResult {
  messageId: string;
}

/**
 * WhatsAppPort — Decouples application WhatsApp dispatch from Meta Cloud API,
 * Twilio WhatsApp, or other providers.
 */
export interface WhatsAppPort {
  /** Asynchronously dispatches a WhatsApp message. */
  send(message: WhatsAppMessage): Promise<WhatsAppResult>;
}