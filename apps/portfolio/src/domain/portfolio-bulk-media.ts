import * as crypto from "node:crypto";
import type { Vendable } from "./vendable.js";

export interface BulkImportResult {
  total: number;
  imported: number;
  errors: Array<{ index: number; reason: string }>;
}

export class PortfolioBulkExporter {
  static toJson(vendables: Vendable[]): string {
    return JSON.stringify(vendables, null, 2);
  }

  static toCsv(vendables: Vendable[]): string {
    const headers = ["id", "title", "category", "price", "currency", "status", "slug"];
    const rows = vendables.map((v) => [
      v.id,
      `"${(v.title ?? "").replace(/"/g, '""')}"`,
      v.category ?? "",
      v.pricing?.basePrice ?? 0,
      v.pricing?.currency ?? "EUR",
      v.status,
      v.seo?.slug ?? "",
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }
}

export class PortfolioBulkImporter {
  static fromJson(jsonStr: string): { valid: Vendable[]; errors: string[] } {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) {
        return { valid: [], errors: ["JSON payload must be an array of vendables."] };
      }
      const valid: Vendable[] = [];
      const errors: string[] = [];

      parsed.forEach((item, idx) => {
        if (!item.id || !item.title) {
          errors.push(`Row ${idx}: Missing id or title`);
        } else {
          valid.push(item as Vendable);
        }
      });
      return { valid, errors };
    } catch (err) {
      return { valid: [], errors: [`JSON Parse error: ${String(err)}`] };
    }
  }
}

export interface CdnSignedUrlOptions {
  width?: number;
  height?: number;
  format?: "webp" | "avif" | "jpeg" | "png";
  expiresInSeconds?: number;
}

export class PortfolioMediaManager {
  constructor(private readonly cdnBaseUrl: string = "https://cdn.mosaix.local", private readonly secretKey: string = "mosaix-cdn-secret") {}

  generateSignedUrl(mediaPath: string, options: CdnSignedUrlOptions = {}): string {
    const format = options.format ?? "webp";
    const width = options.width ? `&w=${options.width}` : "";
    const height = options.height ? `&h=${options.height}` : "";
    const expires = Math.floor(Date.now() / 1000) + (options.expiresInSeconds ?? 3600);

    const payload = `${mediaPath}?fmt=${format}${width}${height}&exp=${expires}`;
    const signature = crypto.createHmac("sha256", this.secretKey).update(payload).digest("hex").slice(0, 16);

    return `${this.cdnBaseUrl}/${payload}&sig=${signature}`;
  }
}
