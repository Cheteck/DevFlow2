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

export * from "@mosaix/ports-intelligence";

export class CapabilityRegistry {
  private static instance: CapabilityRegistry;
  private readonly capabilities = new Map<string, CapabilityDefinition>();

  private constructor() {
    this.registerP0Capabilities();
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

export class MockDecisionProvider implements DecisionProvider {
  public id = "mock";
  public name = "Mock Intelligence Provider";

  public async isAvailable(): Promise<boolean> {
    return true;
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
      decisionId: `dec-mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
        const provider = this.providers.get(pId);
        if (provider && (await provider.isAvailable())) {
          return provider;
        }
      }
    }
    const fallback = this.providers.get(this.defaultProviderId) || this.providers.get("mock");
    if (!fallback) {
      throw new Error(`No available intelligence provider found for capability [${capabilityName}]`);
    }
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

    return await provider.decide<TState, TResult>(requestWithPolicy);
  }

  public async decideBundle(
    bundleRequest: DecisionBundleRequest,
  ): Promise<DecisionBundleResult> {
    const start = Date.now();
    const results: Record<string, DecisionResult> = {};
    let totalConfidence = 0;
    let count = 0;

    for (const [key, subConfig] of Object.entries(bundleRequest.decisions)) {
      const capName = subConfig.capability || `${bundleRequest.capability}.${key}`;
      const singleReq: DecisionRequest = {
        capability: capName,
        state: bundleRequest.state,
        context: bundleRequest.context,
      };
      const result = await this.decide(singleReq);
      results[key] = result;
      totalConfidence += result.confidence;
      count++;
    }

    const provider = count > 0 ? Object.values(results)[0].provider : "mock";
    const model = count > 0 ? Object.values(results)[0].model : "unknown";

    return {
      bundleId: `bundle-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
