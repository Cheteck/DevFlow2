/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import twilio from "twilio";
import { TwilioSmsAdapter } from "./index";

describe("TwilioSmsAdapter", () => {
  it("interacts with Twilio Client messages correctly", async () => {
    let sentCreateOptions: any = null;
    const mockClient: any = {
      messages: {
        create: async (options: any) => {
          sentCreateOptions = options;
          return { sid: "SM12345" };
        },
      },
    };

    const adapter = new TwilioSmsAdapter(
      mockClient as unknown as twilio.Twilio,
    );
    const result = await adapter.send({
      from: "+12345",
      to: "+54321",
      body: "MosaiX text",
    });

    expect(result.messageId).toBe("SM12345");
    expect(sentCreateOptions).toBeDefined();
    expect(sentCreateOptions.from).toBe("+12345");
    expect(sentCreateOptions.to).toBe("+54321");
    expect(sentCreateOptions.body).toBe("MosaiX text");
  });

  it("throws when credentials are missing", () => {
    expect(() => new TwilioSmsAdapter()).toThrow(/accountSid and authToken/i);
    expect(() => new TwilioSmsAdapter({ accountSid: "ACxxx" })).toThrow(
      /accountSid and authToken/i,
    );
  });

  it("uses the explicit mock client when { mock: true } is provided", async () => {
    const adapter = new TwilioSmsAdapter({ mock: true });
    const result = await adapter.send({
      from: "+12345",
      to: "+54321",
      body: "MosaiX text",
    });

    expect(result.messageId).toBeDefined();
    expect(result.messageId).toMatch(/^SM-mock-/);
  });
});
