/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { S3Client } from "@aws-sdk/client-s3";
import { S3StorageAdapter } from "./index";

interface MockS3Client {
  send(command: any): Promise<any>;
}

describe("S3StorageAdapter", () => {
  it("interacts with S3 client commands correctly", async () => {
    // Simple in-memory mock for S3Client send method
    const mockStore = new Map<string, Buffer>();
    const mockClient: MockS3Client = {
      send: async (command: any) => {
        const input = command.input;
        const name = command.constructor.name;

        if (name === "PutObjectCommand") {
          mockStore.set(input.Key, input.Body);
          return {};
        }
        if (name === "GetObjectCommand") {
          const body = mockStore.get(input.Key);
          if (!body) throw new Error("NoSuchKey");
          return {
            Body: {
              transformToByteArray: async () => new Uint8Array(body),
            },
          };
        }
        if (name === "DeleteObjectCommand") {
          mockStore.delete(input.Key);
          return {};
        }
        if (name === "HeadObjectCommand") {
          if (!mockStore.has(input.Key)) {
            const err = new Error("Not Found");
            err.name = "NotFound";
            throw err;
          }
          return {};
        }
        throw new Error(`Unsupported mock command ${name}`);
      },
    };

    const storage = new S3StorageAdapter(
      "my-bucket",
      mockClient as unknown as S3Client,
    );

    await expect(storage.exists("file.txt")).resolves.toBe(false);

    await storage.write("file.txt", "S3 Content");
    await expect(storage.exists("file.txt")).resolves.toBe(true);

    await expect(storage.readString("file.txt")).resolves.toBe("S3 Content");

    await storage.delete("file.txt");
    await expect(storage.exists("file.txt")).resolves.toBe(false);
  });
});
