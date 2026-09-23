/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { SmtpEmailAdapter } from "./index";

describe("SmtpEmailAdapter", () => {
  it("sends mail using mock transporter", async () => {
    let sentMailOptions: any = null;
    const mockTransporter: any = {
      sendMail: async (options: any) => {
        sentMailOptions = options;
        return { messageId: "msg-12345" };
      },
    };

    const adapter = new SmtpEmailAdapter(mockTransporter);
    const result = await adapter.send({
      from: "sender@example.com",
      to: "receiver@example.com",
      subject: "Hello",
      text: "Text body",
    });

    expect(result.messageId).toBe("msg-12345");
    expect(sentMailOptions).toBeDefined();
    expect(sentMailOptions.from).toBe("sender@example.com");
    expect(sentMailOptions.to).toBe("receiver@example.com");
    expect(sentMailOptions.subject).toBe("Hello");
    expect(sentMailOptions.text).toBe("Text body");
  });

  it("throws when no configuration is provided", () => {
    expect(() => new SmtpEmailAdapter()).toThrow(/missing SMTP configuration/i);
  });

  it("throws when the config is empty without an explicit mock", () => {
    expect(() => new SmtpEmailAdapter({})).toThrow(
      /missing SMTP configuration/i,
    );
  });

  it("uses the explicit mock transport when { mock: true } is provided", async () => {
    const adapter = new SmtpEmailAdapter({ mock: true });
    const result = await adapter.send({
      from: "sender@example.com",
      to: "receiver@example.com",
      subject: "Hello",
      text: "Text body",
    });

    expect(result.messageId).toBeDefined();
    expect(typeof result.messageId).toBe("string");
  });

  it("accepts an explicit SMTP transport configuration", async () => {
    let sentMailOptions: any = null;
    const adapter = new SmtpEmailAdapter({
      host: "smtp.example.com",
      port: 2525,
    });
    // Replace the created transporter with a recording one to avoid real SMTP.
    (adapter as any).transporter = {
      sendMail: async (options: any) => {
        sentMailOptions = options;
        return { messageId: "msg-explicit" };
      },
    };

    const result = await adapter.send({
      from: "sender@example.com",
      to: "receiver@example.com",
      subject: "Hello",
      text: "Text body",
    });

    expect(result.messageId).toBe("msg-explicit");
    expect(sentMailOptions.from).toBe("sender@example.com");
  });
});
