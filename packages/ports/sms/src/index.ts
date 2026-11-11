export interface SmsMessage {
  to: string;
  message: string;
}

export interface SmsResult {
  messageId: string;
}

/**
 * SmsPort — Decouples application SMS dispatch from Twilio, MessageBird,
 * or other carriers.
 */
export interface SmsPort {
  /** Asynchronously dispatches an SMS message. */
  send(message: SmsMessage): Promise<SmsResult>;
}