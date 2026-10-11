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
      "reference",
      "type",
      "status",
      "slug",
    ];
    const rows = vendables.map((v) => [
      v.identity.id,
      `"${PortfolioBulkExporter.titleOf(v).replace(/"/g, '""')}"`,
      v.classification.categories?.[0] ?? "",
      v.identity.reference,
      v.identity.type,
      v.identity.status,
      v.seo?.slug ?? "",
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }
}

export class PortfolioBulkImporter {
  /**
   * Commercial columns are PIM-excluded (responsibilities.md § "Wizards, imports et exports").
   * They are ignored on import and reported per row, never persisted.
   */
  private static readonly IGNORED_COMMERCIAL_COLUMNS = new Set([
    "price",
    "currency",
    "pricing",
    "stock",
    "inventory",
    "cost",
    "margin",
    "promotion",
    "discount",
    "availability",
  ]);

  private static stripCommercialFields(
    item: Record<string, unknown>,
  ): { stripped: boolean } {
    let stripped = false;
    for (const key of ["pricing", "inventory"]) {
      if (item[key] !== undefined) {
        delete item[key];
        stripped = true;
      }
    }
    const variants = item["variants"];
    if (Array.isArray(variants)) {
      for (const v of variants) {
        if (typeof v === "object" && v !== null) {
          const variant = v as Record<string, unknown>;
          if (variant["pricing"] !== undefined || variant["inventory"] !== undefined) {
            delete variant["pricing"];
            delete variant["inventory"];
            stripped = true;
          }
        }
      }
    }
    return { stripped };
  }

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
          const record = item as Record<string, unknown>;
          const { stripped } = PortfolioBulkImporter.stripCommercialFields(record);
          if (stripped) {
            errors.push(`Row ${idx}: commercial fields ignored (PIM-only import).`);
          }
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
        const ignored = Object.keys(row).filter((h) =>
          PortfolioBulkImporter.IGNORED_COMMERCIAL_COLUMNS.has(h),
        );
        if (ignored.length > 0) {
          errors.push(
            `Line ${i + 1}: commercial columns ignored (PIM-only import): ${ignored.join(", ")}.`,
          );
        }
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
  cdnBaseUrl: string;
  secretKey: string;
}

export class PortfolioMediaManager {
  private readonly cdnBaseUrl: string;
  private readonly secretKey: string;

  constructor(options: PortfolioMediaManagerOptions) {
    // No process.env reads, no dev fallback: secrets must be injected explicitly
    // (future: SecretsPort/ConfigPort). PIM never exposes secrets.
    if (!options.cdnBaseUrl || !options.secretKey) {
      throw new Error(
        "PortfolioMediaManager requires explicit { cdnBaseUrl, secretKey } options.",
      );
    }
    this.cdnBaseUrl = options.cdnBaseUrl;
    this.secretKey = options.secretKey;
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
