import { createHash } from "node:crypto";

export interface SyncableItem {
  id: string;
  updatedAt: Date | string;
  isDeleted?: boolean;
  [key: string]: unknown;
}

export interface DeltaSyncResponse<T extends SyncableItem> {
  items: T[];
  deletedIds: string[];
  serverTimestamp: string;
  eTag: string;
  isModified: boolean;
}

/**
 * Engine for high-efficiency Mobile Delta-Sync and HTTP Caching
 * Minimizes bandwidth and battery usage for Android Room SQLite clients.
 */
export class DeltaSyncEngine {
  /**
   * Generates a strong ETag based on item IDs and update timestamps
   */
  public static computeETag(items: SyncableItem[]): string {
    const signature = items.map((i) => `${i.id}:${new Date(i.updatedAt).getTime()}`).join("|");
    const hash = createHash("sha1").update(signature).digest("hex").substring(0, 16);
    return `"${hash}"`;
  }

  /**
   * Computes delta changes since a specified client timestamp
   */
  public static calculateDelta<T extends SyncableItem>(
    allItems: T[],
    clientSince?: string | Date,
    clientIfNoneMatch?: string
  ): DeltaSyncResponse<T> {
    const serverTimestamp = new Date().toISOString();
    const eTag = this.computeETag(allItems);

    // 1. ETag match (304 Not Modified optimization)
    if (clientIfNoneMatch && clientIfNoneMatch === eTag) {
      return {
        items: [],
        deletedIds: [],
        serverTimestamp,
        eTag,
        isModified: false,
      };
    }

    // 2. Full Sync if no since timestamp provided
    if (!clientSince) {
      const activeItems = allItems.filter((i) => !i.isDeleted);
      return {
        items: activeItems,
        deletedIds: [],
        serverTimestamp,
        eTag,
        isModified: true,
      };
    }

    // 3. Delta computation
    const sinceTime = new Date(clientSince).getTime();
    const modifiedSince = allItems.filter((i) => new Date(i.updatedAt).getTime() > sinceTime);

    const items: T[] = [];
    const deletedIds: string[] = [];

    for (const item of modifiedSince) {
      if (item.isDeleted) {
        deletedIds.push(item.id);
      } else {
        items.push(item);
      }
    }

    return {
      items,
      deletedIds,
      serverTimestamp,
      eTag,
      isModified: true,
    };
  }
}
