import { describe, it, expect } from "vitest";
import {
  VendableCharacteristicsSchema,
  MediaItemMetadataSchema,
  CommerceOfferMetadataSchema,
  PostMetadataSchema,
  AuditLogMetadataSchema,
} from "./index.js";

describe("DATA-08 Metadata Schemas", () => {
  it("validates VendableCharacteristicsSchema", () => {
    const valid = VendableCharacteristicsSchema.parse({
      attributes: { color: "red", size: "XL", inStock: true },
      specifications: { weight: 1.5 },
    });
    expect(valid.attributes?.color).toBe("red");
  });

  it("validates MediaItemMetadataSchema", () => {
    const valid = MediaItemMetadataSchema.parse({
      alt: "Product image",
      width: 800,
      height: 600,
      format: "png",
    });
    expect(valid.alt).toBe("Product image");
  });

  it("validates CommerceOfferMetadataSchema", () => {
    const valid = CommerceOfferMetadataSchema.parse({
      sku: "SKU-12345",
      notes: "Special promo",
      taxCode: "TAX-20",
    });
    expect(valid.sku).toBe("SKU-12345");
  });

  it("validates PostMetadataSchema", () => {
    const valid = PostMetadataSchema.parse({
      options: ["Yes", "No"],
      vendableId: "v-99",
      pollType: "single_choice",
    });
    expect(valid.vendableId).toBe("v-99");
  });

  it("validates AuditLogMetadataSchema", () => {
    const valid = AuditLogMetadataSchema.parse({
      ip: "127.0.0.1",
      userAgent: "Mozilla/5.0",
      action: "user.login",
    });
    expect(valid.ip).toBe("127.0.0.1");
  });
});
