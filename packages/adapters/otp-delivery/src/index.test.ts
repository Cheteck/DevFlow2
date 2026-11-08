import { OtpDeliveryDispatcher } from "./index.js";
import type { EmailPort, EmailResult } from "@mosaix/ports-email";
import type { SmsPort, SmsResult } from "@mosaix/ports-sms";
import type { WhatsAppPort, WhatsAppResult } from "@mosaix/ports-whatsapp";

class MockEmail implements EmailPort {
  async send(): Promise<EmailResult> {
    return { messageId: "email-123" };
  }
}

class MockSms implements SmsPort {
  async send(): Promise<SmsResult> {
    return { messageId: "sms-456" };
  }
}

class MockWhatsApp implements WhatsAppPort {
  async send(): Promise<WhatsAppResult> {
    return { messageId: "wa-789" };
  }
}

describe("OtpDeliveryDispatcher", () => {
  const email = new MockEmail();
  const sms = new MockSms();
  const whatsapp = new MockWhatsApp();
  const dispatcher = new OtpDeliveryDispatcher(email, sms, whatsapp);

  test("sends email OTP", async () => {
    const cmd = { destination: "user@example.com", channel: "email" as const, message: "Code: 123456" };
    const res = await dispatcher.send(cmd);
    expect(res.messageId).toBe("email-123");
  });

  test("sends SMS OTP", async () => {
    const cmd = { destination: "+33612345678", channel: "sms" as const, message: "Code: 123456" };
    const res = await dispatcher.send(cmd);
    expect(res.messageId).toBe("sms-456");
  });

  test("sends WhatsApp OTP", async () => {
    const cmd = { destination: "+33612345678", channel: "whatsapp" as const, message: "Code: 123456" };
    const res = await dispatcher.send(cmd);
    expect(res.messageId).toBe("wa-789");
  });

  test("throws on unsupported channel", async () => {
    const cmd = { destination: "x", channel: "unknown" as any, message: "Code" };
    await expect(dispatcher.send(cmd)).rejects.toThrow("unsupported channel");
  });
});
