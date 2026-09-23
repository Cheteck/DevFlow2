/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import amqp from "amqplib";
import { RabbitMqPubSubAdapter } from "./index";

describe("RabbitMqPubSubAdapter", () => {
  it("interacts with amqplib channel methods correctly", async () => {
    let assertedExchange: string = "";
    let publishedExchange: string = "";
    let publishedPayload: string = "";

    const mockChannel: any = {
      assertExchange: async (ex: string) => {
        assertedExchange = ex;
        return {};
      },
      publish: (ex: string, route: string, content: Buffer) => {
        publishedExchange = ex;
        publishedPayload = content.toString();
      },
      close: async () => {},
    };

    const mockConnection: any = {
      createChannel: async () => mockChannel,
      close: async () => {},
    };

    const adapter = new RabbitMqPubSubAdapter(
      mockConnection as unknown as amqp.ChannelModel,
    );

    await adapter.publish("orders", { id: "123" });
    expect(assertedExchange).toBe("orders");
    expect(publishedExchange).toBe("orders");
    expect(publishedPayload).toBe(JSON.stringify({ id: "123" }));
  });
});
