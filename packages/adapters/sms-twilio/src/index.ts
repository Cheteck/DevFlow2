import twilio from "twilio";
import type { SmsPort, SmsMessage, SmsResult } from "@mosaix/ports-sms";

export interface TwilioSmsAdapterConfig {
  /** Twilio Account SID. */
  accountSid?: string;
  /** Twilio Auth Token. */
  authToken?: string;
  /** Explicitly opt into the offline mock client (never contacts Twilio). */
  mock?: boolean;
}

/** Minimal surface the adapter relies on for the explicit mock mode. */
interface MockTwilioClient {
  messages: {
    create(options: {
      from: string;
      to: string;
      body: string;
    }): Promise<{ sid: string }>;
  };
}

function createMockTwilioClient(): MockTwilioClient {
  return {
    messages: {
      async create(_options: {
        from: string;
        to: string;
        body: string;
      }): Promise<{ sid: string }> {
        return { sid: `SM-mock-${Date.now()}-${Math.random()}` };
      },
    },
  };
}

export class TwilioSmsAdapter implements SmsPort {
  private readonly client: twilio.Twilio | MockTwilioClient;

  constructor(clientOrConfig?: twilio.Twilio | TwilioSmsAdapterConfig) {
    if (
      clientOrConfig &&
      (clientOrConfig instanceof twilio.Twilio ||
        (typeof clientOrConfig === "object" && "messages" in clientOrConfig))
    ) {
      this.client = clientOrConfig as twilio.Twilio;
      return;
    }

    const config: TwilioSmsAdapterConfig =
      clientOrConfig ?? ({} as TwilioSmsAdapterConfig);

    if (config.mock === true) {
      this.client = createMockTwilioClient();
      return;
    }

    if (
      typeof config.accountSid !== "string" ||
      config.accountSid.length === 0 ||
      typeof config.authToken !== "string" ||
      config.authToken.length === 0
    ) {
      throw new Error(
        "TwilioSmsAdapter: accountSid and authToken are required. Provide a Twilio client instance, a config with `accountSid`/`authToken`, or `{ mock: true }` to explicitly opt into the mock client.",
      );
    }

    this.client = twilio(config.accountSid, config.authToken);
  }

  async send(message: SmsMessage): Promise<SmsResult> {
    const res = await this.client.messages.create({
      from: message.from,
      to: message.to,
      body: message.body,
    });

    return {
      messageId: res.sid || `twilio-${Date.now()}-${Math.random()}`,
    };
  }
}
