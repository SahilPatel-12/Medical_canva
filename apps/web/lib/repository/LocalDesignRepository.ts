import { DesignDocument, CreateDesignInput, DesignRepository, sanitizePages } from "@design-platform/types";

export interface LocalDesignRepositoryOptions {
  userId?: string;
  workspaceId?: string;
}

export class LocalDesignRepository implements DesignRepository {
  private userId?: string;
  private workspaceId?: string;

  constructor(options?: LocalDesignRepositoryOptions) {
    this.userId = options?.userId;
    this.workspaceId = options?.workspaceId;
  }

  public setScope(userId?: string, workspaceId?: string): void {
    this.userId = userId;
    this.workspaceId = workspaceId;
  }

  private isBrowser(): boolean {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  }

  /**
   * Scopes localStorage key by authenticated user ID and workspace ID.
   * If user or workspace is missing, returns null to avoid leaking cross-account designs.
   */
  private getStorageKey(workspaceId?: string): string | null {
    const wsId = workspaceId || this.workspaceId;
    if (this.userId && wsId) {
      return `design_platform_docs_${this.userId}_${wsId}`;
    }
    return null;
  }

  private getStoredDocs(workspaceId?: string): DesignDocument[] {
    if (!this.isBrowser()) return [];

    const key = this.getStorageKey(workspaceId);
    if (!key) {
      // Unauthenticated or unscoped: return empty to prevent data leakage
      return [];
    }

    try {
      const data = localStorage.getItem(key);
      if (!data) {
        return [];
      }
      return JSON.parse(data) as DesignDocument[];
    } catch (err) {
      console.error("[LocalDesignRepository] Error reading designs from localStorage:", err);
      return [];
    }
  }

  private saveStoredDocs(docs: DesignDocument[], workspaceId?: string): void {
    if (!this.isBrowser()) return;

    const key = this.getStorageKey(workspaceId);
    if (!key) {
      return;
    }

    try {
      localStorage.setItem(key, JSON.stringify(docs));
    } catch (err) {
      console.error("[LocalDesignRepository] Error saving designs to localStorage:", err);
    }
  }

  public async list(workspaceId?: string): Promise<DesignDocument[]> {
    const targetWsId = workspaceId || this.workspaceId;
    if (!targetWsId) return [];

    const docs = this.getStoredDocs(targetWsId);
    return [...docs].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });
  }

  public async getById(id: string, workspaceId?: string): Promise<DesignDocument | null> {
    if (!id) return null;
    const targetWsId = workspaceId || this.workspaceId;
    const docs = this.getStoredDocs(targetWsId);
    const found = docs.find((d) => d.id === id);
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  public async create(input: CreateDesignInput): Promise<DesignDocument> {
    const targetWsId = input.workspaceId || this.workspaceId;
    const docs = this.getStoredDocs(targetWsId);
    const now = new Date().toISOString();
    const id = `des_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const newDoc: DesignDocument = {
      id,
      workspaceId: targetWsId,
      name: input.name.trim() || "Untitled Design",
      width: input.width || 1200,
      height: input.height || 800,
      backgroundColor: input.backgroundColor || "#ffffff",
      createdAt: now,
      updatedAt: now,
      pages: sanitizePages(
        input.pages && input.pages.length > 0
          ? input.pages
          : [
              {
                id: `page_${Date.now()}`,
                name: "Page 1",
                elements: [],
              },
            ]
      ),
    };

    docs.unshift(newDoc);
    this.saveStoredDocs(docs, targetWsId);
    return newDoc;
  }

  public async update(
    id: string,
    updates: Partial<DesignDocument>,
    workspaceId?: string
  ): Promise<DesignDocument> {
    const targetWsId = workspaceId || this.workspaceId;
    const docs = this.getStoredDocs(targetWsId);
    const index = docs.findIndex((d) => d.id === id);

    if (index === -1) {
      throw new Error(`Design with id ${id} not found`);
    }

    const current = docs[index];
    if (!current) {
      throw new Error(`Design with id ${id} not found`);
    }

    const cleanPages = updates.pages !== undefined ? sanitizePages(updates.pages) : current.pages;

    const updated: DesignDocument = {
      ...current,
      ...updates,
      pages: cleanPages,
      id: current.id,
      workspaceId: current.workspaceId || targetWsId,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };

    docs[index] = updated;
    this.saveStoredDocs(docs, targetWsId);
    return updated;
  }

  public async delete(id: string, workspaceId?: string): Promise<void> {
    const targetWsId = workspaceId || this.workspaceId;
    const docs = this.getStoredDocs(targetWsId);
    const filtered = docs.filter((d) => d.id !== id);
    this.saveStoredDocs(filtered, targetWsId);
  }

  public async duplicate(id: string, workspaceId?: string): Promise<DesignDocument> {
    const targetWsId = workspaceId || this.workspaceId;
    const original = await this.getById(id, targetWsId);
    if (!original) {
      throw new Error(`Design with id ${id} not found`);
    }

    const now = new Date().toISOString();
    const newId = `des_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const cloned: DesignDocument = {
      ...JSON.parse(JSON.stringify(original)),
      id: newId,
      workspaceId: targetWsId,
      name: `${original.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };

    const docs = this.getStoredDocs(targetWsId);
    docs.unshift(cloned);
    this.saveStoredDocs(docs, targetWsId);
    return cloned;
  }
}
