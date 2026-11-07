/**
 * @apps/portfolio — Vendable Workflow Engine Integration
 *
 * Centralises publication validation: completeness is computed server-side
 * via PortfolioService.calculateCompleteness(), never hard-coded on the caller.
 */

import type { PortfolioService } from "./domain/portfolio-service.js";
import type { InformationQuality, Vendable } from "./domain/vendable.js";

export interface VendableWorkflowContext {
  vendableId: string;
  status: "Draft" | "In Review" | "Validated" | "Published" | "Archived";
  qualityPassed?: boolean;
}

export interface PublishValidationResult {
  valid: boolean;
  completeness?: number;
  missingFields?: string[];
  errors: string[];
}

export class VendableWorkflow {
  /**
   * Minimum completeness threshold required to publish.
   * Defined here (single source of truth) so callers and tests share one constant.
   */
  static readonly PUBLISH_MIN_COMPLETENESS = 70;

  /**
   * Validate that a vendable is eligible for publication.
   * Computes completeness server-side; does NOT trust a caller-supplied flag.
   */
  validatePublishable(
    vendable: Vendable | undefined,
    portfolioService: PortfolioService,
  ): PublishValidationResult {
    if (!vendable) {
      return { valid: false, errors: ["Vendable introuvable."] };
    }

    const quality = portfolioService.calculateCompleteness(vendable);
    const errors: string[] = [];

    if (quality.completeness < VendableWorkflow.PUBLISH_MIN_COMPLETENESS) {
      errors.push(
        `Complétude insuffisante (${quality.completeness}/100, minimum ${VendableWorkflow.PUBLISH_MIN_COMPLETENESS}).`,
      );
    }

    // Type-specific required attributes are already flagged in missingFields.
    if (quality.missingFields.length > 0) {
      errors.push(`Champs manquants: ${quality.missingFields.join(", ")}`);
    }

    return {
      valid: errors.length === 0,
      completeness: quality.completeness,
      missingFields: quality.missingFields,
      errors,
    };
  }

  async publish(context: VendableWorkflowContext): Promise<{
    status: string;
    validated: boolean;
    completeness?: number;
  }> {
    // Steps kept for backward compatibility with existing callers that
    // drive the engine directly. Real publication goes through
    // validatePublishable() + PortfolioService.updateWorkflowStatus().
    const steps = [
      {
        name: "validateCompleteness",
        execute: (ctx: VendableWorkflowContext) => {
          if (!ctx.qualityPassed) {
            throw new Error("Vendable completeness validation failed.");
          }
        },
      },
      {
        name: "publishVendable",
        execute: (ctx: VendableWorkflowContext) => {
          ctx.status = "Published";
        },
        compensate: (ctx: VendableWorkflowContext) => {
          ctx.status = "Draft";
        },
      },
    ];

    for (const step of steps) {
      step.execute(context);
    }

    return { status: context.status, validated: true };
  }
}