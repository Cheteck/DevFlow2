/**
 * @mosaix/core — Token Deep Merge Engine
 */

export function deepMergeTokens(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...target };
  if (!source || typeof source !== "object") return output;

  for (const key of Object.keys(source)) {
    const targetVal = output[key];
    const sourceVal = source[key];
    if (
      sourceVal !== null &&
      typeof sourceVal === "object" &&
      targetVal !== null &&
      typeof targetVal === "object"
    ) {
      output[key] = deepMergeTokens(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      );
    } else {
      output[key] = sourceVal;
    }
  }

  return output;
}
