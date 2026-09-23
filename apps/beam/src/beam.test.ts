import { describe, expect, it } from "vitest";
import { createBeamComposition } from "./composition-root.js";
import { registerBeamAdminPages } from "../frontend/src/index.js";

describe("MosaiX Beam Instant Messenger Suite", () => {
  it("instantiates Composition Root with Container, Router, and Messaging Service", () => {
    const composition = createBeamComposition();

    expect(composition.container).toBeDefined();
    expect(composition.router).toBeDefined();
    expect(composition.messagingService).toBeDefined();
    expect(composition.controller).toBeDefined();
  });

  it("handles conversation creation and instant message dispatch via BeamMessagingController", async () => {
    const composition = createBeamComposition();

    // 1. Create a conversation
    const createConvRes = await composition.controller.createConversation({
      method: "POST",
      path: "/beam/conversations",
      headers: {},
      body: {
        title: "Équipe Architecture MosaiX",
        type: "group",
        participants: ["usr-alex", "usr-jules"],
      },
    });

    expect(createConvRes.statusCode).toBe(201);
    const convBody = createConvRes.body as { conversation: { id: string; type: string } };
    expect(convBody.conversation.id).toBeDefined();
    expect(convBody.conversation.type).toBe("group");

    const convId = convBody.conversation.id;

    // 2. Send an instant message
    const sendMsgRes = await composition.controller.sendMessage({
      method: "POST",
      path: "/beam/messages",
      headers: {},
      body: {
        conversationId: convId,
        senderId: "usr-jules",
        content: "L'application Beam est désormais active sur la plateforme !",
      },
    });

    expect(sendMsgRes.statusCode).toBe(201);
    const sendBody = sendMsgRes.body as { message: string; sentMessage?: unknown };
    expect(sendBody.message).toBe("Message envoyé");
    expect(sendBody.sentMessage).toBeDefined();

    // 3. Fetch conversation messages
    const getMsgsRes = await composition.controller.getMessages({
      method: "GET",
      path: "/beam/messages",
      headers: {},
      params: { conversationId: convId },
    });

    expect(getMsgsRes.statusCode).toBe(200);
    const getMsgsBody = getMsgsRes.body as { messages: Array<{ content: string }> };
    expect(getMsgsBody.messages.length).toBe(1);
    expect(getMsgsBody.messages[0]?.content).toContain("Beam est désormais active");
  });

  it("exports UI admin page contributions for Imperia and Shell integration", () => {
    const adminPages = registerBeamAdminPages();
    expect(adminPages.length).toBeGreaterThan(0);
    expect(adminPages[0]?.applicationId).toBe("@apps/beam");
    expect(adminPages[0]?.entrypoint).toBe("messaging-admin");
  });
});
