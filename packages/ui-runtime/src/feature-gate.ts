import { featureAsync, featureVariationAsync } from "@mosaix/sdk";
import type { FeatureFlagKey, FeatureFlagUserContext } from "@mosaix/ports-feature-flags";

/**
 * FeatureGate — Declarative UI Feature Gate Helper for MosaiX SSR and Slots
 */
export class FeatureGate {
  /**
   * Evaluates feature flag and renders active Content HTML if enabled, or fallback HTML if disabled.
   */
  public static async renderGate(
    flagKey: FeatureFlagKey | string,
    activeHtml: string | ((context?: FeatureFlagUserContext) => string | Promise<string>),
    fallbackHtml = "",
    context?: FeatureFlagUserContext,
  ): Promise<string> {
    const isEnabled = await featureAsync(flagKey, context, false);

    if (isEnabled) {
      if (typeof activeHtml === "function") {
        return Promise.resolve(activeHtml(context));
      }
      return activeHtml;
    }

    if (typeof fallbackHtml === "function") {
      return Promise.resolve((fallbackHtml as (context?: FeatureFlagUserContext) => string | Promise<string>)(context));
    }
    return fallbackHtml;
  }

  /**
   * Renders a variation string flag value into a UI layout slot.
   */
  public static async renderVariation(
    flagKey: FeatureFlagKey | string,
    variations: Record<string, string | ((context?: FeatureFlagUserContext) => string | Promise<string>)>,
    defaultVariationKey = "default",
    context?: FeatureFlagUserContext,
  ): Promise<string> {
    const variantKey = await featureVariationAsync(flagKey, context, defaultVariationKey);
    const renderer = variations[variantKey] ?? variations[defaultVariationKey];

    if (typeof renderer === "function") {
      return Promise.resolve(renderer(context));
    }
    return renderer ?? "";
  }
}

export const renderFeatureGate = FeatureGate.renderGate;
