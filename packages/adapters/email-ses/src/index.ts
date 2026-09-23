import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import type { EmailPort, EmailMessage, EmailResult } from "@mosaix/ports-email";

export class SesEmailAdapter implements EmailPort {
  private readonly client: SESClient;

  constructor(clientOrConfig?: SESClient | Record<string, unknown>) {
    if (
      clientOrConfig &&
      (clientOrConfig instanceof SESClient ||
        (typeof clientOrConfig === "object" && "send" in clientOrConfig))
    ) {
      this.client = clientOrConfig as SESClient;
    } else {
      this.client = new SESClient(
        (clientOrConfig as Record<string, unknown>) ?? {},
      );
    }
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    const toAddresses = Array.isArray(message.to) ? message.to : [message.to];
    const ccAddresses =
      message.cc !== undefined
        ? Array.isArray(message.cc)
          ? message.cc
          : [message.cc]
        : [];
    const bccAddresses =
      message.bcc !== undefined
        ? Array.isArray(message.bcc)
          ? message.bcc
          : [message.bcc]
        : [];

    const cmd = new SendEmailCommand({
      Source: message.from,
      Destination: {
        ToAddresses: toAddresses,
        CcAddresses: ccAddresses.length > 0 ? ccAddresses : undefined,
        BccAddresses: bccAddresses.length > 0 ? bccAddresses : undefined,
      },
      Message: {
        Subject: {
          Data: message.subject,
          Charset: "UTF-8",
        },
        Body: {
          Text:
            message.text !== undefined
              ? { Data: message.text, Charset: "UTF-8" }
              : undefined,
          Html:
            message.html !== undefined
              ? { Data: message.html, Charset: "UTF-8" }
              : undefined,
        },
      },
    });

    const res = await this.client.send(cmd);
    return {
      messageId: res.MessageId || `ses-${Date.now()}-${Math.random()}`,
    };
  }
}
