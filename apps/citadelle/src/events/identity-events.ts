export const identityUserCreatedEvent = "citadelle.user.created";
export const identityUserUpdatedEvent = "citadelle.user.updated";

export const identityEventPayloadSchemas: Record<string, unknown> = {
  [identityUserCreatedEvent]: {
    type: "object",
    properties: {
      userId: { type: "string" },
      email: { type: "string" },
    },
    required: ["userId", "email"],
  },
  [identityUserUpdatedEvent]: {
    type: "object",
    properties: {
      userId: { type: "string" },
      email: { type: "string" },
    },
    required: ["userId"],
  },
};
