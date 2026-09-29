/**
 * Storage driver types
 */
export type StorageDriverType = "s3" | "r2" | "local";

/**
 * Storage configuration options
 */
export interface StorageDriverConfig {
  driver: StorageDriverType;
  endpoint?: string;
  bucket: string;
  region?: string;
  accessKey?: string;
  secretKey?: string;
}

/**
 * File metadata abstraction for uploads/assets
 */
export interface StorageFileMetadata {
  key: string;
  bucket: string;
  contentType: string;
  sizeBytes: number;
  publicUrl?: string;
}

/**
 * Abstract interface for storage driver implementations
 */
export interface IStorageDriver {
  getSignedUploadUrl(key: string, contentType: string, expiresInSeconds?: number): Promise<string>;
  getPublicUrl(key: string): string;
  deleteFile(key: string): Promise<void>;
}
