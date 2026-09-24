export const identityUserCreatedEvent = "citadelle.user.created";
export const identityUserUpdatedEvent = "citadelle.user.updated";
export const identityPasswordChangedEvent = "citadelle.user.password_changed";
export const identityMfaEnabledEvent = "citadelle.user.mfa_enabled";

export const identityEventPayloadSchemas: Record<string, unknown> = {
  [identityUserCreatedEvent]: {
    type: "object",
    properties: {
      userId: { type: "string" },
      email: { type: "string" },
      roles: { type: "array", items: { type: "string" } },
    },
    required: ["userId", "email"],
  },
  [identityUserUpdatedEvent]: {
    type: "object",
    properties: {
      userId: { type: "string" },
      email: { type: "string" },
      displayName: { type: "string" },
    },
    required: ["userId"],
  },
  [identityPasswordChangedEvent]: {
    type: "object",
    properties: {
      userId: { type: "string" },
      timestamp: { type: "string" },
    },
    required: ["userId", "timestamp"],
  },
  [identityMfaEnabledEvent]: {
    type: "object",
    properties: {
      userId: { type: "string" },
      mfaType: { type: "string" },
      timestamp: { type: "string" },
    },
    required: ["userId", "mfaType", "timestamp"],
  },
};

