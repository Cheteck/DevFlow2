import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import type { StoragePort } from "@mosaix/ports-storage";

export class S3StorageAdapter implements StoragePort {
  private readonly client: S3Client;

  constructor(
    private readonly bucketName: string,
    clientOrConfig?: S3Client | Record<string, unknown>,
  ) {
    if (
      clientOrConfig &&
      (clientOrConfig instanceof S3Client ||
        (typeof clientOrConfig === "object" && "send" in clientOrConfig))
    ) {
      this.client = clientOrConfig as S3Client;
    } else {
      this.client = new S3Client(
        (clientOrConfig as Record<string, unknown>) ?? {},
      );
    }
  }

  async write(path: string, content: Buffer | string): Promise<void> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: path,
      Body: typeof content === "string" ? Buffer.from(content) : content,
    });
    await this.client.send(cmd);
  }

  async read(path: string): Promise<Buffer> {
    const cmd = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: path,
    });
    const result = await this.client.send(cmd);
    const body = result.Body;
    if (!body) {
      throw new Error(`Empty body returned from S3 for key "${path}"`);
    }

    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async readString(path: string): Promise<string> {
    const buffer = await this.read(path);
    return buffer.toString("utf-8");
  }

  async delete(path: string): Promise<void> {
    const cmd = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: path,
    });
    await this.client.send(cmd);
  }

  async exists(path: string): Promise<boolean> {
    const cmd = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: path,
    });
    try {
      await this.client.send(cmd);
      return true;
    } catch (error: unknown) {
      if (error && typeof error === "object") {
        if ("name" in error && error.name === "NotFound") {
          return false;
        }
        const errWithMetadata = error as {
          $metadata?: { httpStatusCode?: number };
        };
        if (errWithMetadata.$metadata?.httpStatusCode === 404) {
          return false;
        }
      }
      throw error;
    }
  }
}
