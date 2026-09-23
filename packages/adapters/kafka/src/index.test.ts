/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { Kafka } from "kafkajs";
import { KafkaPubSubAdapter } from "./index";

describe("KafkaPubSubAdapter", () => {
  it("interacts with KafkaJS client correctly", async () => {
    let sentTopic: string = "";
    let sentMessage: string = "";

    const mockProducer: any = {
      connect: async () => {},
      send: async (payload: any) => {
        sentTopic = payload.topic;
        sentMessage = payload.messages[0].value;
      },
      disconnect: async () => {},
    };

    const mockClient: any = {
      producer: () => mockProducer,
    };

    const adapter = new KafkaPubSubAdapter(mockClient as unknown as Kafka);

    await adapter.publish("orders", { id: "123" });
    expect(sentTopic).toBe("orders");
    expect(sentMessage).toBe(JSON.stringify({ id: "123" }));
  });
});
