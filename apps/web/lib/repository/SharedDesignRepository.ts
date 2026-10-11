import {
  DesignDocument,
  DesignRepository,
  CreateDesignInput,
} from "@design-platform/types";
import { SupabaseShareRepository, SupabaseClient } from "@design-platform/database";
import { getBrowserSupabaseClient } from "@design-platform/auth";

export interface SharedDesignRepositoryOptions {
  token: string;
  client?: SupabaseClient;
  onPermissionRevoked?: (reason: string) => void;
}

export class SharedDesignRepository implements DesignRepository {
  private token: string;
  private client?: SupabaseClient;
  private shareRepo: SupabaseShareRepository;
  private onPermissionRevoked?: (reason: string) => void;

  constructor(options: SharedDesignRepositoryOptions) {
    this.token = options.token;
    this.client = options.client || (typeof window !== "undefined" ? getBrowserSupabaseClient() : undefined);
    this.onPermissionRevoked = options.onPermissionRevoked;
    this.shareRepo = new SupabaseShareRepository({ client: this.client });
  }

  public async getById(id: string): Promise<DesignDocument | null> {
    try {
      const details = await this.shareRepo.getSharedDesign(this.token);
      if (!details || details.design.id !== id) {
        return null;
      }
      return details.design;
    } catch (err) {
      console.warn("[SharedDesignRepository] Error fetching shared design:", err);
      return null;
    }
  }

  public async list(): Promise<DesignDocument[]> {
    const doc = await this.getById("");
    return doc ? [doc] : [];
  }

  public async update(
    id: string,
    updates: Partial<DesignDocument>
  ): Promise<DesignDocument> {
    try {
      return await this.shareRepo.updateSharedDesignContent(
        id,
        this.token,
        updates.pages || [],
        updates.thumbnail
      );
    } catch (err) {
      const msg = (err as Error)?.message || "Failed to save changes to shared design";
      if (
        msg.includes("viewing permissions") ||
        msg.includes("forbidden") ||
        msg.includes("disabled") ||
        msg.includes("expired") ||
        msg.includes("revoked")
      ) {
        this.onPermissionRevoked?.(msg);
      }
      throw err;
    }
  }

  public async create(_input: CreateDesignInput): Promise<DesignDocument> {
    throw new Error("Cannot create new designs via a shared design link");
  }

  public async delete(_id: string): Promise<void> {
    throw new Error("Shared design recipients cannot delete the original design");
  }

  public async duplicate(_id: string): Promise<DesignDocument> {
    throw new Error("Duplicating shared designs is not permitted under link sharing");
  }
}
