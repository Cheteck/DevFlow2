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

  static titleOf(vendable: Vendable): string {
    const localized = Object.values(vendable.content ?? {});
    return localized[0]?.name ?? "";
  }

  static toCsv(vendables: Vendable[]): string {
    const headers = [
      "id",
      "title",
      "category",
      "price",
      "currency",
      "status",
      "slug",
    ];
    const rows = vendables.map((v) => [
      v.identity.id,
      `"${PortfolioBulkExporter.titleOf(v).replace(/"/g, '""')}"`,
      v.classification.categories?.[0] ?? "",
      v.pricing?.basePrice ?? 0,
      v.pricing?.currency ?? "EUR",
      v.identity.status,
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
        return {
          valid: [],
          errors: ["JSON payload must be an array of vendables."],
        };
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

  static fromCsv(csvStr: string): {
    valid: Partial<Vendable>[];
    errors: string[];
  } {
    const lines = csvStr.trim().split("\n");
    if (lines.length < 2) {
      return { valid: [], errors: ["CSV file is empty or missing data rows."] };
    }
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const valid: Partial<Vendable>[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? "";
      });

      if (!row.id || !row.title) {
        errors.push(`Line ${i + 1}: Required fields 'id' or 'title' missing.`);
      } else {
        valid.push({
          identity: {
            id: row.id,
            reference: row.id,
            type: "Product",
            status: (row.status as Vendable["identity"]["status"]) || "Draft",
          },
          content: { default: { name: row.title } },
          characteristics: { attributes: {} },
          classification: row.category ? { categories: [row.category] } : {},
          media: [],
          variants: [],
          relations: [],
          pricing: {
            basePrice: row.price ? parseFloat(row.price) : 0,
            currency: row.currency || "EUR",
          },
        });
      }
    }

    return { valid, errors };
  }
}

export interface CdnSignedUrlOptions {
  width?: number;
  height?: number;
  format?: "webp" | "avif" | "jpeg" | "png";
  expiresInSeconds?: number;
}

export interface PortfolioMediaManagerOptions {
  cdnBaseUrl?: string;
  secretKey?: string;
}

function resolveEnv(key: string): string | undefined {
  const v = typeof process !== "undefined" ? process.env?.[key] : undefined;
  return v && v.length > 0 ? v : undefined;
}

export class PortfolioMediaManager {
  private readonly cdnBaseUrl: string;
  private readonly secretKey: string;

  constructor(
    cdnBaseUrl?: string | PortfolioMediaManagerOptions,
    secretKey?: string,
  ) {
    const opts: PortfolioMediaManagerOptions =
      typeof cdnBaseUrl === "object" && cdnBaseUrl !== null
        ? cdnBaseUrl
        : { cdnBaseUrl: cdnBaseUrl as string | undefined, secretKey };
    this.cdnBaseUrl =
      opts.cdnBaseUrl ??
      resolveEnv("MOSAIX_CDN_BASE_URL") ??
      "https://cdn.mosaix.local";
    this.secretKey =
      opts.secretKey ??
      resolveEnv("MOSAIX_CDN_SECRET") ??
      "mosaix-cdn-secret-dev-only";
    if (
      typeof process !== "undefined" &&
      process.env?.NODE_ENV === "production" &&
      this.secretKey.includes("dev-only")
    ) {
      throw new Error(
        "MOSAIX_CDN_SECRET must be set in production (no dev fallback).",
      );
    }
  }

  generateSignedUrl(
    mediaPath: string,
    options: CdnSignedUrlOptions = {},
  ): string {
    const format = options.format ?? "webp";
    const width = options.width ? `&w=${options.width}` : "";
    const height = options.height ? `&h=${options.height}` : "";
    const expires =
      Math.floor(Date.now() / 1000) + (options.expiresInSeconds ?? 3600);

    const payload = `${mediaPath}?fmt=${format}${width}${height}&exp=${expires}`;
    const signature = crypto
      .createHmac("sha256", this.secretKey)
      .update(payload)
      .digest("hex")
      .slice(0, 16);

    return `${this.cdnBaseUrl}/${payload}&sig=${signature}`;
  }
}
