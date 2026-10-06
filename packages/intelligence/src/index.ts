import { randomUUID } from "node:crypto";
import {
  AIPolicy,
  CapabilityDefinition,
  ConfidenceLevel,
  ConfidenceThresholds,
  DecisionBundleRequest,
  DecisionBundleResult,
  DecisionProvider,
  DecisionRequest,
  DecisionResult,
} from "@mosaix/ports-intelligence";
import { EventDispatcher } from "@mosaix/events";

export * from "@mosaix/ports-intelligence";

export class CapabilityRegistry {
  private static instance: CapabilityRegistry;
  private readonly capabilities = new Map<string, CapabilityDefinition>();

  private constructor() {
    this.registerP0Capabilities();
    this.registerP1Capabilities();
  }

  public static getInstance(): CapabilityRegistry {
    if (!CapabilityRegistry.instance) {
      CapabilityRegistry.instance = new CapabilityRegistry();
    }
    return CapabilityRegistry.instance;
  }

  public register(capability: CapabilityDefinition): void {
    this.capabilities.set(capability.name, capability);
  }

  public get(name: string): CapabilityDefinition | undefined {
    return this.capabilities.get(name);
  }

  public list(): CapabilityDefinition[] {
    return Array.from(this.capabilities.values());
  }

  private registerP0Capabilities(): void {
    const p0Caps: CapabilityDefinition[] = [
      {
        name: "commerce.product.classify",
        version: 1,
        description: "Classifies e-commerce product into taxonomy category, brand, and attributes",
        category: "commerce",
        riskLevel: "low",
        allowedProviders: ["mock", "typesafe", "local"],
        defaultThresholds: { automatic: 0.95, assisted: 0.75 },
        humanReviewSupported: true,
      },
      {
        name: "commerce.product.extract",
        version: 1,
        description: "Extracts structured specifications and features from unstructured text",
        category: "commerce",
        riskLevel: "low",
        allowedProviders: ["mock", "typesafe", "local"],
        defaultThresholds: { automatic: 0.9, assisted: 0.7 },
        humanReviewSupported: true,
      },
      {
        name: "commerce.product.quality.score",
        version: 1,
        description: "Evaluates listing quality score and completeness rating",
        category: "commerce",
        riskLevel: "low",
        allowedProviders: ["mock", "typesafe"],
        defaultThresholds: { automatic: 0.85, assisted: 0.65 },
        humanReviewSupported: false,
      },
      {
        name: "commerce.seller.risk.score",
        version: 1,
        description: "Assesses seller risk score from transaction and return history",
        category: "commerce",
        riskLevel: "high",
        allowedProviders: ["mock", "typesafe"],
        defaultThresholds: { automatic: 0.98, assisted: 0.85 },
        humanReviewSupported: true,
      },
      {
        name: "beam.message.intent",
        version: 1,
        description: "Classifies incoming chat message intent for routing or automated replies",
        category: "beam",
        riskLevel: "medium",
        allowedProviders: ["mock", "typesafe", "local"],
        defaultThresholds: { automatic: 0.92, assisted: 0.75 },
        humanReviewSupported: true,
      },
      {
        name: "spaces.content.moderate",
        version: 1,
        description: "Analyzes social or space text for toxicity, spam, and policy violations",
        category: "spaces",
        riskLevel: "high",
        allowedProviders: ["mock", "typesafe", "local"],
        defaultThresholds: { automatic: 0.96, assisted: 0.8 },
        humanReviewSupported: true,
      },
    ];

    for (const cap of p0Caps) {
      this.register(cap);
    }
  }

  private registerP1Capabilities(): void {
    const p1Caps: CapabilityDefinition[] = [
      {
        name: "commerce.order.fraud.score",
        version: 1,
        description: "Evaluates transaction anomaly and checkout fraud risk score",
        category: "commerce",
        riskLevel: "critical",
        allowedProviders: ["mock", "typesafe"],
        defaultThresholds: { automatic: 0.99, assisted: 0.9 },
        humanReviewSupported: true,
      },
      {
        name: "identity.document.verify",
        version: 1,
        description: "Verifies user identity document authenticity and OCR extraction",
        category: "citadelle",
        riskLevel: "critical",
        allowedProviders: ["mock", "typesafe"],
        defaultThresholds: { automatic: 0.98, assisted: 0.85 },
        humanReviewSupported: true,
      },
      {
        name: "solidarity.incident.classify",
        version: 1,
        description: "Categorizes crisis signal and humanitarian incident urgency",
        category: "solidarity",
        riskLevel: "high",
        allowedProviders: ["mock", "typesafe"],
        defaultThresholds: { automatic: 0.95, assisted: 0.8 },
        humanReviewSupported: true,
      },
      {
        name: "booking.no-show.score",
        version: 1,
        description: "Predicts reservation cancellation and no-show probability",
        category: "booking",
        riskLevel: "low",
        allowedProviders: ["mock", "typesafe"],
        defaultThresholds: { automatic: 0.9, assisted: 0.7 },
        humanReviewSupported: false,
      },
    ];

    for (const cap of p1Caps) {
      this.register(cap);
    }
  }
}

export class IntelligenceKillSwitch {
  private static instance: IntelligenceKillSwitch;
  private disabledCapabilities = new Set<string>();
  private disabledProviders = new Set<string>();

  private constructor() {}

  public static getInstance(): IntelligenceKillSwitch {
    if (!IntelligenceKillSwitch.instance) {
      IntelligenceKillSwitch.instance = new IntelligenceKillSwitch();
    }
    return IntelligenceKillSwitch.instance;
  }

  public disableCapability(name: string): void {
    this.disabledCapabilities.add(name);
  }

  public enableCapability(name: string): void {
    this.disabledCapabilities.delete(name);
  }

  public disableProvider(providerId: string): void {
    this.disabledProviders.add(providerId);
  }

  public enableProvider(providerId: string): void {
    this.disabledProviders.delete(providerId);
  }

  public isCapabilityDisabled(name: string): boolean {
    return this.disabledCapabilities.has(name);
  }

  public isProviderDisabled(providerId: string): boolean {
    return this.disabledProviders.has(providerId);
  }

  public resetAll(): void {
    this.disabledCapabilities.clear();
    this.disabledProviders.clear();
  }
}

export class ConfidenceEngine {
  public static evaluateLevel(
    confidence: number,
    thresholds: ConfidenceThresholds,
  ): ConfidenceLevel {
    if (confidence >= thresholds.automatic) {
      return "AUTO";
    }
    if (confidence >= thresholds.assisted) {
      return "SUGGEST";
    }
    return "HUMAN";
  }
}

export interface ReviewItem {
  id: string;
  decisionId: string;
  capability: string;
  originalResult: DecisionResult;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CORRECTED";
  humanValue?: unknown;
  humanReason?: string;
  actorId?: string;
  createdAt: string;
  resolvedAt?: string;
}

export class HumanReviewQueue {
  private static instance: HumanReviewQueue;
  private items = new Map<string, ReviewItem>();

  private constructor() {}

  public static getInstance(): HumanReviewQueue {
    if (!HumanReviewQueue.instance) {
      HumanReviewQueue.instance = new HumanReviewQueue();
    }
    return HumanReviewQueue.instance;
  }

  public enqueue(decisionResult: DecisionResult): ReviewItem {
    const reviewId = `rev-${randomUUID()}`;
    const item: ReviewItem = {
      id: reviewId,
      decisionId: decisionResult.decisionId,
      capability: decisionResult.capability,
      originalResult: decisionResult,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };
    this.items.set(reviewId, item);

    new EventDispatcher().dispatch(
      "intelligence.review.required",
      { reviewId, decisionId: decisionResult.decisionId, capability: decisionResult.capability },
      "system.intelligence",
    );

    return item;
  }

  public resolve(
    reviewId: string,
    resolution: {
      status: "APPROVED" | "REJECTED" | "CORRECTED";
      humanValue?: unknown;
      humanReason?: string;
      actorId?: string;
    },
  ): ReviewItem | undefined {
    const item = this.items.get(reviewId);
    if (!item) return undefined;

    item.status = resolution.status;
    item.humanValue = resolution.humanValue;
    item.humanReason = resolution.humanReason;
    item.actorId = resolution.actorId;
    item.resolvedAt = new Date().toISOString();

    // Only record human override rate when the AI prediction was modified or rejected
    if (resolution.status === "CORRECTED" || resolution.status === "REJECTED") {
      IntelligenceMetricsCollector.getInstance().recordHumanOverride();
    }

    new EventDispatcher().dispatch(
      "intelligence.review.completed",
      { reviewId, decisionId: item.decisionId, status: item.status, actorId: item.actorId },
      "system.intelligence",
    );

    return item;
  }

  public listPending(): ReviewItem[] {
    return Array.from(this.items.values()).filter((i) => i.status === "PENDING");
  }

  public get(id: string): ReviewItem | undefined {
    return this.items.get(id);
  }
}

export class IntelligenceMetricsCollector {
  private static instance: IntelligenceMetricsCollector;
  private totalDecisions = 0;
  private totalCostAmount = 0;
  private totalTokens = 0;
  private humanOverrides = 0;
  private fallbackCount = 0;

  private constructor() {}

  public static getInstance(): IntelligenceMetricsCollector {
    if (!IntelligenceMetricsCollector.instance) {
      IntelligenceMetricsCollector.instance = new IntelligenceMetricsCollector();
    }
    return IntelligenceMetricsCollector.instance;
  }

  public recordDecision(result: DecisionResult): void {
    this.totalDecisions++;
    this.totalCostAmount += result.estimatedCostAmount || 0;
    this.totalTokens += result.estimatedCostTokens || 0;
  }

  public recordHumanOverride(): void {
    this.humanOverrides++;
  }

  public recordFallback(): void {
    this.fallbackCount++;
  }

  public getSnapshot() {
    const overrideRate = this.totalDecisions > 0 ? (this.humanOverrides / this.totalDecisions) * 100 : 0;
    return {
      totalDecisions: this.totalDecisions,
      totalCostAmount: Number(this.totalCostAmount.toFixed(4)),
      totalTokens: this.totalTokens,
      humanOverrides: this.humanOverrides,
      overrideRate: Number(overrideRate.toFixed(2)),
      fallbackCount: this.fallbackCount,
    };
  }
}

export class MockDecisionProvider implements DecisionProvider {
  public id = "mock";
  public name = "Mock Intelligence Provider";

  public async isAvailable(): Promise<boolean> {
    return !IntelligenceKillSwitch.getInstance().isProviderDisabled(this.id);
  }

  public async decide<TState = unknown, TResult = unknown>(
    request: DecisionRequest<TState>,
  ): Promise<DecisionResult<TResult>> {
    const start = Date.now();
    const cap = CapabilityRegistry.getInstance().get(request.capability);
    const thresholds = request.policy?.thresholds || cap?.defaultThresholds || { automatic: 0.95, assisted: 0.75 };

    let mockValue: unknown = { status: "processed", state: request.state };
    let confidence = 0.98;

    if (request.capability === "commerce.product.classify") {
      const state = request.state as { title?: string } | undefined;
      const title = state?.title || "Product";
      mockValue = {
        category: "smartphones",
        brand: title.toLowerCase().includes("samsung") ? "Samsung" : "Generic",
        storage: title.includes("512") ? "512GB" : "128GB",
      };
    } else if (request.capability === "beam.message.intent") {
      mockValue = { intent: "order_problem" };
      confidence = 0.96;
    } else if (request.capability === "spaces.content.moderate") {
      mockValue = { flagged: false, category: "safe" };
      confidence = 0.99;
    }

    const level = ConfidenceEngine.evaluateLevel(confidence, thresholds);

    return {
      decisionId: `dec-mock-${randomUUID()}`,
      capability: request.capability,
      value: mockValue as TResult,
      confidence,
      confidenceLevel: level,
      provider: this.id,
      model: "mock-v1",
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }
}

export class ProviderRouter {
  private readonly providers = new Map<string, DecisionProvider>();
  private defaultProviderId = "mock";

  constructor() {
    this.register(new MockDecisionProvider());
  }

  public register(provider: DecisionProvider): void {
    this.providers.set(provider.id, provider);
  }

  public setDefaultProvider(providerId: string): void {
    if (this.providers.has(providerId)) {
      this.defaultProviderId = providerId;
    }
  }

  public async resolveProvider(capabilityName: string): Promise<DecisionProvider> {
    const cap = CapabilityRegistry.getInstance().get(capabilityName);
    if (cap) {
      for (const pId of cap.allowedProviders) {
        if (IntelligenceKillSwitch.getInstance().isProviderDisabled(pId)) {
          continue;
        }
        const provider = this.providers.get(pId);
        if (provider && (await provider.isAvailable())) {
          return provider;
        }
      }
    }
    const fallback = this.providers.get(this.defaultProviderId) || this.providers.get("mock");
    if (!fallback || !(await fallback.isAvailable())) {
      throw new Error(`No available intelligence provider found for capability [${capabilityName}]`);
    }
    IntelligenceMetricsCollector.getInstance().recordFallback();
    return fallback;
  }
}

export class IntelligenceRuntime {
  private readonly router: ProviderRouter;

  constructor(router?: ProviderRouter) {
    this.router = router || new ProviderRouter();
  }

  public getRouter(): ProviderRouter {
    return this.router;
  }

  public async decide<TState = unknown, TResult = unknown>(
    request: DecisionRequest<TState>,
  ): Promise<DecisionResult<TResult>> {
    if (IntelligenceKillSwitch.getInstance().isCapabilityDisabled(request.capability)) {
      throw new Error(`Intelligence capability [${request.capability}] is disabled by Kill Switch`);
    }

    const provider = await this.router.resolveProvider(request.capability);
    const cap = CapabilityRegistry.getInstance().get(request.capability);

    const mergedPolicy: AIPolicy = {
      capability: request.capability,
      thresholds: request.policy?.thresholds || cap?.defaultThresholds || { automatic: 0.95, assisted: 0.75 },
      fallbackType: request.policy?.fallbackType || "human",
    };

    const requestWithPolicy: DecisionRequest<TState> = {
      ...request,
      policy: mergedPolicy,
    };

    const result = await provider.decide<TState, TResult>(requestWithPolicy);

    // Record metrics & cost
    IntelligenceMetricsCollector.getInstance().recordDecision(result);

    // Human Review Queue trigger if confidence falls below assisted/automatic threshold
    if (result.confidenceLevel === "HUMAN" && cap?.humanReviewSupported) {
      HumanReviewQueue.getInstance().enqueue(result);
    }

    new EventDispatcher().dispatch(
      "intelligence.decision.completed",
      {
        decisionId: result.decisionId,
        capability: result.capability,
        provider: result.provider,
        confidence: result.confidence,
        confidenceLevel: result.confidenceLevel,
      },
      "system.intelligence",
    );

    return result;
  }

  public async decideBundle(
    bundleRequest: DecisionBundleRequest,
  ): Promise<DecisionBundleResult> {
    const start = Date.now();
    const entries = Object.entries(bundleRequest.decisions);

    const settledResults = await Promise.allSettled(
      entries.map(async ([key, subConfig]) => {
        const capName = subConfig.capability || `${bundleRequest.capability}.${key}`;
        const singleReq: DecisionRequest = {
          capability: capName,
          state: bundleRequest.state,
          context: bundleRequest.context,
        };
        const res = await this.decide(singleReq);
        return { key, res };
      }),
    );

    const results: Record<string, DecisionResult> = {};
    let totalConfidence = 0;
    let count = 0;

    for (const settled of settledResults) {
      if (settled.status === "fulfilled") {
        results[settled.value.key] = settled.value.res;
        totalConfidence += settled.value.res.confidence;
        count++;
      } else {
        IntelligenceMetricsCollector.getInstance().recordFallback();
      }
    }

    const provider = count > 0 ? Object.values(results)[0].provider : "mock";
    const model = count > 0 ? Object.values(results)[0].model : "unknown";

    return {
      bundleId: `bundle-${randomUUID()}`,
      capability: bundleRequest.capability,
      results,
      overallConfidence: count > 0 ? totalConfidence / count : 1.0,
      provider,
      model,
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }
}
