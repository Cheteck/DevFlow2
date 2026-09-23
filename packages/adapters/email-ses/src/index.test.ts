/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { SESClient } from "@aws-sdk/client-ses";
import { SesEmailAdapter } from "./index";

describe("SesEmailAdapter", () => {
  it("interacts with SESClient correctly", async () => {
    let sentCommandInput: any = null;
    const mockClient: any = {
      send: async (cmd: any) => {
        sentCommandInput = cmd.input;
        return { MessageId: "ses-12345" };
      },
    };

    const adapter = new SesEmailAdapter(mockClient as unknown as SESClient);
    const result = await adapter.send({
      from: "welcome@example.com",
      to: "user@example.com",
      subject: "Welcome",
      text: "Body",
    });

    expect(result.messageId).toBe("ses-12345");
    expect(sentCommandInput).toBeDefined();
    expect(sentCommandInput.Source).toBe("welcome@example.com");
    expect(sentCommandInput.Destination.ToAddresses).toEqual([
      "user@example.com",
    ]);
    expect(sentCommandInput.Message.Subject.Data).toBe("Welcome");
    expect(sentCommandInput.Message.Body.Text.Data).toBe("Body");
  });
});
