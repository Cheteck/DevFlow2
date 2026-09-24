import type {
  Vendable,
  InformationQuality,
  WorkflowStatus,
  VendableType,
} from "./vendable";
import type { VendableRepository } from "./vendable-repository";
import {
  VendableNotFoundError,
  DuplicateVendableReferenceError,
  InvalidWorkflowTransitionError,
  SelfRelationError,
  DuplicateVariantReferenceError,
  OperationalKeyForbiddenError,
} from "./portfolio-errors";

export interface SearchCriteria {
  id?: string | undefined;
  reference?: string | undefined;
  type?: string | undefined;
  status?: string | undefined;
  name?: string | undefined;
  description?: string | undefined;
  category?: string | undefined;
  tag?: string | undefined;
  collection?: string | undefined;
  language?: string | undefined;
  attribute?: { key: string; value?: unknown } | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface UpdateVendableInput {
  content?: Vendable["content"] | undefined;
  characteristics?: Vendable["characteristics"] | undefined;
  classification?: Vendable["classification"] | undefined;
  media?: Vendable["media"] | undefined;
  variants?: Vendable["variants"] | undefined;
  relations?: Vendable["relations"] | undefined;
  identity?:
    | {
        status?: WorkflowStatus | undefined;
        reference?: string | undefined;
      }
    | undefined;
}

const ALLOWED_CSV_STATUSES: WorkflowStatus[] = [
  "Draft",
  "In Review",
  "Validated",
  "Published",
  "Archived",
];

import { parseCsvRecord, isSafeAttributeKey } from "./csv-parser.js";

export class PortfolioService {
  constructor(private readonly repository: VendableRepository) {}

  private static FORBIDDEN_OPERATIONAL_KEYS = [
    "price",
    "pricing",
    "stock",
    "inventory",
    "seller",
    "available",
    "availability",
    "booking",
    "order",
    "transaction",
    "pricing_period",
  ];

  private static ALLOWED_WORKFLOW_TRANSITIONS: Record<
    WorkflowStatus,
    WorkflowStatus[]
  > = {
    Draft: ["In Review", "Draft"],
    "In Review": ["Validated", "Draft"],
    Validated: ["Published", "Draft"],
    Published: ["Archived", "Draft"],
    Archived: ["Draft"],
  };

  /**
   * Validate domain invariants on a vendable.
   */
  private validateDomainInvariants(vendable: Vendable): void {
    // 1. Check self-relations
    if (vendable.relations) {
      for (const rel of vendable.relations) {
        if (rel.targetId === vendable.identity.id) {
          throw new SelfRelationError(vendable.identity.id);
        }
      }
    }

    // 2. Check variant reference uniqueness
    if (vendable.variants && vendable.variants.length > 0) {
      const seenRefs = new Set<string>();
      for (const variant of vendable.variants) {
        if (seenRefs.has(variant.reference)) {
          throw new DuplicateVariantReferenceError(variant.reference);
        }
        seenRefs.add(variant.reference);
      }
    }

    // 3. Reject operational/commercial keys
    this.validateNoOperationalKeys(vendable);
  }

  /**
   * Reject any transactional/operational keys inside attributes, specifications, or metadata.
   */
  private validateNoOperationalKeys(vendable: Vendable): void {
    const checkKey = (key: string) => {
      const lower = key.toLowerCase();
      for (const forbidden of PortfolioService.FORBIDDEN_OPERATIONAL_KEYS) {
        if (lower.includes(forbidden)) {
          throw new OperationalKeyForbiddenError(key);
        }
      }
    };

    if (vendable.characteristics.attributes) {
      Object.keys(vendable.characteristics.attributes).forEach(checkKey);
    }
    if (vendable.characteristics.specifications) {
      Object.keys(vendable.characteristics.specifications).forEach(checkKey);
    }

    if (vendable.media) {
      vendable.media.forEach((item) => {
        if (item.metadata) {
          Object.keys(item.metadata).forEach(checkKey);
        }
      });
    }

    if (vendable.variants) {
      vendable.variants.forEach((v) => {
        if (v.characteristics?.attributes) {
          Object.keys(v.characteristics.attributes).forEach(checkKey);
        }
        if (v.characteristics?.specifications) {
          Object.keys(v.characteristics.specifications).forEach(checkKey);
        }
        if (v.media) {
          v.media.forEach((m) => {
            if (m.metadata) {
              Object.keys(m.metadata).forEach(checkKey);
            }
          });
        }
      });
    }

    if (vendable.relations) {
      vendable.relations.forEach((r) => {
        if (r.metadata) {
          Object.keys(r.metadata).forEach(checkKey);
        }
      });
    }
  }

  /**
   * Create a new vendable.
   */
  async createVendable(vendable: Vendable): Promise<Vendable> {
    const existingById = await this.repository.findById(vendable.identity.id);
    if (existingById) {
      throw new Error(
        `Vendable with ID [${vendable.identity.id}] already exists.`,
      );
    }

    const existingByRef = await this.repository.findByReference(
      vendable.identity.reference,
    );
    if (existingByRef) {
      throw new DuplicateVendableReferenceError(vendable.identity.reference);
    }

    this.validateDomainInvariants(vendable);

    const withQuality: Vendable = {
      ...vendable,
      quality: this.calculateCompleteness(vendable),
    };

    await this.repository.save(withQuality);
    return withQuality;
  }

  /**
   * Find a vendable by ID.
   */
  async findVendable(id: string): Promise<Vendable | undefined> {
    return this.repository.findById(id);
  }

  /**
   * Update an existing vendable.
   */
  async updateVendable(
    id: string,
    updates: UpdateVendableInput,
  ): Promise<Vendable> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new VendableNotFoundError(id);
    }

    const newIdentity = { ...existing.identity };
    if (updates.identity?.status !== undefined) {
      this.validateWorkflowTransition(
        existing.identity.status,
        updates.identity.status,
      );
      newIdentity.status = updates.identity.status;
    }
    if (updates.identity?.reference !== undefined) {
      const existingRef = await this.repository.findByReference(
        updates.identity.reference,
      );
      if (existingRef && existingRef.identity.id !== id) {
        throw new DuplicateVendableReferenceError(updates.identity.reference);
      }
      newIdentity.reference = updates.identity.reference;
    }

    const updated: Vendable = {
      identity: newIdentity,
      content:
        updates.content !== undefined ? updates.content : existing.content,
      characteristics:
        updates.characteristics !== undefined
          ? updates.characteristics
          : existing.characteristics,
      classification:
        updates.classification !== undefined
          ? updates.classification
          : existing.classification,
      media: updates.media !== undefined ? updates.media : existing.media,
      variants:
        updates.variants !== undefined ? updates.variants : existing.variants,
      relations:
        updates.relations !== undefined
          ? updates.relations
          : existing.relations,
    };

    this.validateDomainInvariants(updated);

    updated.quality = this.calculateCompleteness(updated);
    await this.repository.save(updated);
    return updated;
  }

  /**
   * Delete a vendable by ID.
   */
  async deleteVendable(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new VendableNotFoundError(id);
    }
    await this.repository.delete(id);
  }

  /**
   * List all vendables.
   */
  async listVendables(): Promise<Vendable[]> {
    return this.repository.findAll();
  }

  /**
   * Update the workflow status of a vendable adhering to the state machine.
   */
  async updateWorkflowStatus(
    id: string,
    targetStatus: WorkflowStatus,
  ): Promise<Vendable> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new VendableNotFoundError(id);
    }

    this.validateWorkflowTransition(existing.identity.status, targetStatus);

    const next: Vendable = {
      ...existing,
      identity: { ...existing.identity, status: targetStatus },
      quality: this.calculateCompleteness({ ...existing, identity: { ...existing.identity, status: targetStatus } }),
    };
    await this.repository.save(next);
    return next;
  }

  /**
   * Validate state machine transitions for workflow status.
   */
  private validateWorkflowTransition(
    currentStatus: WorkflowStatus,
    targetStatus: WorkflowStatus,
  ): void {
    if (currentStatus === targetStatus) return;
    const allowed =
      PortfolioService.ALLOWED_WORKFLOW_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new InvalidWorkflowTransitionError(currentStatus, targetStatus);
    }
  }

  /**
   * Search vendables by criteria.
   */
  async search(criteria: SearchCriteria): Promise<Vendable[]> {
    const all = await this.repository.findAll();
    const filtered = all.filter((v) => {
      if (criteria.id !== undefined && v.identity.id !== criteria.id)
        return false;
      if (
        criteria.reference !== undefined &&
        v.identity.reference !== criteria.reference
      )
        return false;
      if (criteria.type !== undefined && v.identity.type !== criteria.type)
        return false;
      if (
        criteria.status !== undefined &&
        v.identity.status !== criteria.status
      )
        return false;

      if (criteria.name !== undefined) {
        const matchesName = Object.values(v.content).some((c) =>
          c.name.toLowerCase().includes(criteria.name!.toLowerCase()),
        );
        if (!matchesName) return false;
      }

      if (criteria.description !== undefined) {
        const matchesDesc = Object.values(v.content).some((c) =>
          c.description
            ?.toLowerCase()
            .includes(criteria.description!.toLowerCase()),
        );
        if (!matchesDesc) return false;
      }

      if (criteria.language !== undefined) {
        if (!v.content[criteria.language]) return false;
      }

      if (criteria.category !== undefined) {
        const categories = v.classification.categories || [];
        if (!categories.includes(criteria.category)) return false;
      }

      if (criteria.tag !== undefined) {
        const tags = v.classification.tags || [];
        if (!tags.includes(criteria.tag)) return false;
      }

      if (criteria.collection !== undefined) {
        const collections = v.classification.collections || [];
        if (!collections.includes(criteria.collection)) return false;
      }

      if (criteria.attribute !== undefined) {
        const { key, value } = criteria.attribute;
        if (v.characteristics.attributes[key] !== value) return false;
      }

      return true;
    });

    const offset = Math.max(0, criteria.offset ?? 0);
    const limit = criteria.limit ?? filtered.length;
    if (offset === 0 && limit >= filtered.length) return filtered;
    return filtered.slice(offset, offset + Math.max(0, limit));
  }

  /**
   * Calculate completeness of information for a vendable.
   */
  calculateCompleteness(vendable: Vendable): InformationQuality {
    let completeness = 0;
    const missingFields: string[] = [];

    const hasName = Object.values(vendable.content).some((c) => !!c.name);
    if (hasName) {
      completeness += 20;
    } else {
      missingFields.push("name");
    }

    const hasDescription = Object.values(vendable.content).some(
      (c) => !!c.description,
    );
    if (hasDescription) {
      completeness += 20;
    } else {
      missingFields.push("description");
    }

    const hasCategory = !!(
      vendable.classification.categories &&
      vendable.classification.categories.length > 0
    );
    if (hasCategory) {
      completeness += 20;
    } else {
      missingFields.push("categories");
    }

    const hasMedia = !!(vendable.media && vendable.media.length > 0);
    if (hasMedia) {
      completeness += 15;
    } else {
      missingFields.push("media");
    }

    const hasAttributes = !!(
      vendable.characteristics.attributes &&
      Object.keys(vendable.characteristics.attributes).length > 0
    );
    if (hasAttributes) {
      completeness += 15;
    } else {
      missingFields.push("attributes");
    }

    const hasTags = !!(
      vendable.classification.tags && vendable.classification.tags.length > 0
    );
    if (hasTags) {
      completeness += 10;
    } else {
      missingFields.push("tags");
    }

    const attrs = vendable.characteristics.attributes || {};
    const type = vendable.identity.type;
    if (type === "Service") {
      if (attrs["duration"] === undefined) {
        completeness = Math.max(0, completeness - 5);
        missingFields.push("duration_attribute");
      }
    } else if (type === "Product") {
      if (attrs["material"] === undefined && attrs["weight"] === undefined) {
        completeness = Math.max(0, completeness - 5);
        missingFields.push("material_or_weight_attribute");
      }
    } else if (type === "Experience") {
      if (attrs["requirements"] === undefined) {
        completeness = Math.max(0, completeness - 5);
        missingFields.push("requirements_attribute");
      }
    } else if (type === "DigitalProduct") {
      if (attrs["fileSize"] === undefined && attrs["format"] === undefined) {
        completeness = Math.max(0, completeness - 5);
        missingFields.push("filesize_or_format_attribute");
      }
    }

    const targetLangs = ["fr", "en", "ar"];
    targetLangs.forEach((lang) => {
      const translation = vendable.content[lang];
      if (!translation || !translation.name || !translation.description) {
        completeness = Math.max(0, completeness - 5);
        missingFields.push(`translation_${lang}`);
      }
    });

    return {
      completeness,
      missingFields,
    };
  }

  /**
   * Export vendables to a simple CSV string.
   */
  async exportCsv(): Promise<string> {
    const all = await this.repository.findAll();
    const header =
      "id,reference,type,status,name,description,categories,attributes\n";
    const rows = all.map((v) => {
      const content = v.content["fr"] ||
        Object.values(v.content)[0] || { name: "", description: "" };
      const name = content.name.replace(/"/g, '""');
      const desc = (content.description || "").replace(/"/g, '""');
      const cats = (v.classification.categories || []).join(";");

      const attrsList: string[] = [];
      for (const [key, val] of Object.entries(v.characteristics.attributes)) {
        attrsList.push(`${key}=${val}`);
      }
      const attrs = attrsList.join(";");

      return `"${v.identity.id}","${v.identity.reference}","${v.identity.type}","${v.identity.status}","${name}","${desc}","${cats}","${attrs}"`;
    });

    return header + rows.join("\n");
  }

  /**
   * Import vendables from a simple CSV string.
   */
  async importCsv(csvContent: string): Promise<Vendable[]> {
    const lines = csvContent.trim().split("\n");
    if (lines.length <= 1) return [];

    const imported: Vendable[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (!line) continue;

      const parts = parseCsvRecord(line);

      if (parts.length < 5) continue;

      const [
        id,
        reference,
        type,
        statusStr,
        name,
        description,
        categoriesStr,
        attributesStr,
      ] = parts;
      if (!id || !reference || !type) continue;

      const status: WorkflowStatus = ALLOWED_CSV_STATUSES.includes(
        statusStr as WorkflowStatus,
      )
        ? (statusStr as WorkflowStatus)
        : "Draft";
      const categories = categoriesStr ? categoriesStr.split(";") : [];
      const attributes: Record<string, unknown> = {};

      if (attributesStr) {
        const pairs = attributesStr.split(";");
        for (const pair of pairs) {
          const eqIndex = pair.indexOf("=");
          if (eqIndex > 0) {
            const key = pair.substring(0, eqIndex).trim();
            if (!key || !isSafeAttributeKey(key)) continue;
            const val = pair.substring(eqIndex + 1);
            attributes[key] = val;
          }
        }
      }

      const vendable: Vendable = {
        identity: {
          id,
          reference,
          type: type as VendableType,
          status,
        },
        content: {
          fr: {
            name: name || "",
            description: description || "",
          },
        },
        characteristics: {
          attributes,
        },
        classification: {
          categories,
        },
        media: [],
        variants: [],
        relations: [],
      };

      await this.createVendable(vendable);
      imported.push(vendable);
    }

    return imported;
  }
}
