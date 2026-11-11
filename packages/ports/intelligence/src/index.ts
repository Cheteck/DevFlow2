export type ConfidenceLevel = "AUTO" | "SUGGEST" | "HUMAN";

export interface ConfidenceThresholds {
  automatic: number; // e.g. 0.95
  assisted: number;  // e.g. 0.75
}

export interface AIPolicy {
  capability: string;
  thresholds: ConfidenceThresholds;
  fallbackType?: "human" | "secondary_provider" | "rule_based";
  maxLatencyMs?: number;
  allowedDataClassifications?: Array<"PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "SENSITIVE" | "RESTRICTED">;
}

export interface DecisionRequest<TState = unknown> {
  capability: string;
  state: TState;
  policy?: AIPolicy;
  context?: {
    bacId?: string;
    spaceId?: string;
    userId?: string;
    tenantId?: string;
    correlationId?: string;
  };
}

export interface DecisionResult<TResult = unknown> {
  decisionId: string;
  capability: string;
  value: TResult;
  confidence: number; // 0.0 - 1.0
  confidenceLevel: ConfidenceLevel;
  probabilities?: Record<string, number>;
  provider: string;
  model: string;
  latencyMs: number;
  estimatedCostTokens?: number;
  estimatedCostAmount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface DecisionBundleRequest {
  capability: string;
  state: unknown;
  decisions: Record<string, { capability?: string; options?: Record<string, unknown> }>;
  context?: DecisionRequest["context"];
}

export interface DecisionBundleResult {
  bundleId: string;
  capability: string;
  results: Record<string, DecisionResult>;
  overallConfidence: number;
  provider: string;
  model: string;
  latencyMs: number;
  timestamp: string;
}

export interface CapabilityDefinition {
  name: string;
  version: number;
  description: string;
  category: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  allowedProviders: string[];
  defaultThresholds: ConfidenceThresholds;
  inputSchemaName?: string;
  outputSchemaName?: string;
  humanReviewSupported: boolean;
}

export interface DecisionProvider {
  id: string;
  name: string;
  isAvailable(): Promise<boolean>;
  decide<TState = unknown, TResult = unknown>(
    request: DecisionRequest<TState>
  ): Promise<DecisionResult<TResult>>;
}
