import { describe, expect, it } from "vitest";
import { EnvSecretsAdapter } from "./index";

describe("EnvSecretsAdapter", () => {
  it("resolves secret from custom source", async () => {
    const custom = {
      API_SECRET: "s3cr3t",
    };
    const secrets = new EnvSecretsAdapter(custom);

    await expect(secrets.getSecret("API_SECRET")).resolves.toBe("s3cr3t");
    await expect(secrets.getSecret("UNKNOWN")).resolves.toBeUndefined();

    await expect(secrets.getRequiredSecret("API_SECRET")).resolves.toBe(
      "s3cr3t",
    );
    await expect(secrets.getRequiredSecret("MISSING")).rejects.toThrow(
      /Required secret key "MISSING" is missing/,
    );
  });
});
