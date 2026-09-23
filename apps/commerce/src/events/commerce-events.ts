export const commerceOrderCreatedSchema = {
  safeParse(input: unknown): { success: boolean; error?: unknown } {
    if (typeof input !== "object" || input === null) {
      return { success: false, error: "Expected object" };
    }
    const record = input as Record<string, unknown>;
    const errors: Record<string, string> = {};

    if (typeof record.orderId !== "string" || record.orderId.length === 0) {
      errors.orderId = "orderId must be a non-empty string";
    }
    if (typeof record.customerName !== "string" || record.customerName.length === 0) {
      errors.customerName = "customerName must be a non-empty string";
    }
    if (typeof record.totalAmount !== "number" || record.totalAmount <= 0) {
      errors.totalAmount = "totalAmount must be a positive number";
    }
    if (typeof record.currency !== "string" || record.currency.length !== 3) {
      errors.currency = "currency must be a 3-character string";
    }
    if (typeof record.itemCount !== "number" || record.itemCount <= 0 || !Number.isInteger(record.itemCount)) {
      errors.itemCount = "itemCount must be a positive integer";
    }
    if (typeof record.createdAt !== "string") {
      errors.createdAt = "createdAt must be a string";
    }

    if (Object.keys(errors).length > 0) {
      return { success: false, error: errors };
    }
    return { success: true };
  },
};

export const commerceEventPayloadSchemas = {
  "commerce.order.created": commerceOrderCreatedSchema,
} as const;
