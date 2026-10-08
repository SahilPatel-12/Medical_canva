import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  IStorageDriver,
  StorageDriverConfig,
  StorageFileMetadata,
} from "./index";

export interface S3DriverOptions extends StorageDriverConfig {
  publicUrl?: string;
}

export class S3StorageDriver implements IStorageDriver {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor(options: S3DriverOptions) {
    if (typeof window !== "undefined") {
      throw new Error(
        "[Security] @design-platform/storage can only be instantiated in server-side environments."
      );
    }

    if (!options.bucket) {
      throw new Error("[Storage Config Error] S3 bucket name is required.");
    }
    if (!options.endpoint) {
      throw new Error("[Storage Config Error] S3 endpoint is required.");
    }
    if (!options.accessKey || !options.secretKey) {
      throw new Error("[Storage Config Error] S3 accessKey and secretKey are required.");
    }

    this.bucket = options.bucket;
    this.publicUrl = options.publicUrl?.replace(/\/+$/, "") || "";

    this.client = new S3Client({
      region: options.region || "auto",
      endpoint: options.endpoint,
      credentials: {
        accessKeyId: options.accessKey,
        secretAccessKey: options.secretKey,
      },
      // Cloudflare R2 requires path-style or standard virtual-hosted, R2 supports both but forcePathStyle=false is default
    });
  }

  public getPublicUrl(key: string): string {
    const cleanKey = key.replace(/^\/+/, "");
    if (this.publicUrl) {
      return `${this.publicUrl}/${cleanKey}`;
    }
    return `https://${this.bucket}.r2.cloudflarestorage.com/${cleanKey}`;
  }

  public async uploadFile(
    key: string,
    body: Buffer | Uint8Array | string,
    contentType: string
  ): Promise<StorageFileMetadata> {
    const cleanKey = key.replace(/^\/+/, "");
    const buffer = typeof body === "string" ? Buffer.from(body, "utf-8") : Buffer.from(body);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
      Body: buffer,
      ContentType: contentType,
    });

    await this.client.send(command);

    return {
      key: cleanKey,
      bucket: this.bucket,
      contentType,
      sizeBytes: buffer.byteLength,
      publicUrl: this.getPublicUrl(cleanKey),
    };
  }

  public async getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds: number = 3600
  ): Promise<string> {
    const cleanKey = key.replace(/^\/+/, "");
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
      ContentType: contentType,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  public async deleteFile(key: string): Promise<void> {
    const cleanKey = key.replace(/^\/+/, "");
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
    });

    await this.client.send(command);
  }

  public async fileExists(key: string): Promise<boolean> {
    const cleanKey = key.replace(/^\/+/, "");
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
      });
      await this.client.send(command);
      return true;
    } catch (err: unknown) {
      const error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  public async getFileText(key: string): Promise<string> {
    const cleanKey = key.replace(/^\/+/, "");
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
    });

    const response = await this.client.send(command);
    if (!response.Body) {
      throw new Error(`Empty response body for key: ${cleanKey}`);
    }

    return await response.Body.transformToString("utf-8");
  }

  public async listFiles(
    prefix?: string
  ): Promise<{ key: string; size: number; lastModified?: Date }[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix ? prefix.replace(/^\/+/, "") : undefined,
    });

    const response = await this.client.send(command);
    return (
      response.Contents?.map((item) => ({
        key: item.Key || "",
        size: item.Size || 0,
        lastModified: item.LastModified,
      })) || []
    );
  }
}

/**
 * Creates an instance of S3StorageDriver configured from server-side environment variables.
 * Fails fast with descriptive error if required credentials are missing.
 * Strict server boundary: throws immediately if invoked in browser environments.
 */
export function getR2StorageDriver(): S3StorageDriver {
  if (typeof window !== "undefined") {
    throw new Error(
      "[Security] getR2StorageDriver() cannot be called in a browser client environment."
    );
  }

  // Support both standard Cloudflare R2 naming and legacy/generic STORAGE_* aliases
  const endpoint =
    process.env.R2_ENDPOINT ||
    (process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : undefined) ||
    process.env.STORAGE_ENDPOINT;

  const bucket =
    process.env.R2_BUCKET_NAME ||
    process.env.STORAGE_BUCKET;

  const accessKey =
    process.env.R2_ACCESS_KEY_ID ||
    process.env.STORAGE_ACCESS_KEY;

  const secretKey =
    process.env.R2_SECRET_ACCESS_KEY ||
    process.env.STORAGE_SECRET_KEY;

  const publicUrl =
    process.env.STORAGE_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL;

  const region =
    process.env.R2_REGION ||
    process.env.STORAGE_REGION ||
    "auto";

  const missing: string[] = [];
  if (!endpoint) missing.push("R2_ENDPOINT (or R2_ACCOUNT_ID / STORAGE_ENDPOINT)");
  if (!bucket) missing.push("R2_BUCKET_NAME (or STORAGE_BUCKET)");
  if (!accessKey) missing.push("R2_ACCESS_KEY_ID (or STORAGE_ACCESS_KEY)");
  if (!secretKey) missing.push("R2_SECRET_ACCESS_KEY (or STORAGE_SECRET_KEY)");

  if (missing.length > 0) {
    throw new Error(
      `[Storage Config Error] Missing required Cloudflare R2 storage environment variables: ${missing.join(", ")}.`
    );
  }

  return new S3StorageDriver({
    driver: "r2",
    endpoint: endpoint!,
    bucket: bucket!,
    region,
    accessKey: accessKey!,
    secretKey: secretKey!,
    publicUrl,
  });
}
