import * as crypto from "node:crypto";

export interface ChargilyAdapterOptions {
  apiKey?: string;
  secretKey?: string;
  apiUrl?: string; // e.g. "https://pay.chargily.net/test/api/v2" or "https://pay.chargily.net/api/v2"
  isLiveMode?: boolean;
}

export interface ChargilyCheckoutInput {
  amountInCents: number; // e.g. 500000 = 5,000.00 DZD
  currency?: "dzd" | "usd" | "eur" | string;
  paymentMethod?: "edahabia" | "cib" | "card";
  successUrl: string;
  failureUrl?: string;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
  orderId?: string;
  customerEmail?: string;
}

export interface ChargilyCheckoutResult {
  success: boolean;
  checkoutId?: string;
  checkoutUrl?: string;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface ChargilyCheckoutSession {
  id: string;
  status: "pending" | "paid" | "failed" | "canceled" | string;
  amount: number;
  currency: string;
  checkoutUrl: string;
  metadata?: Record<string, unknown>;
}

export class ChargilyPaymentAdapter {
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly apiUrl: string;
  private readonly isLiveMode: boolean;

  constructor(options: ChargilyAdapterOptions = {}) {
    this.apiKey = options.apiKey || "api_key_test_mosaix_chargily_2026";
    this.secretKey = options.secretKey || "secret_key_test_mosaix_chargily_2026";
    this.apiUrl = options.apiUrl || "https://pay.chargily.net/test/api/v2";
    this.isLiveMode = options.isLiveMode ?? false;
  }

  /**
   * Creates a Chargily Pay V2 checkout session (/checkouts).
   */
  public async createCheckoutSession(input: ChargilyCheckoutInput): Promise<ChargilyCheckoutResult> {
    if (!this.isLiveMode) {
      // Simulator / Dev mode response
      const checkoutId = `ch_session_${crypto.randomUUID()}`;
      const checkoutUrl = `${this.apiUrl}/redirect/checkout/${checkoutId}?order=${input.orderId || "unknown"}`;
      return {
        success: true,
        checkoutId,
        checkoutUrl,
        status: "pending",
      };
    }

    try {
      const payload = {
        amount: input.amountInCents / 100, // Chargily V2 API accepts float DZD amount
        currency: (input.currency || "dzd").toLowerCase(),
        payment_method: input.paymentMethod || "edahabia",
        success_url: input.successUrl,
        failure_url: input.failureUrl || input.successUrl,
        webhook_endpoint: input.webhookUrl,
        metadata: {
          orderId: input.orderId,
          ...input.metadata,
        },
      };

      const response = await fetch(`${this.apiUrl}/checkouts`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.secretKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json() as Record<string, unknown>;

      if (response.ok && data.id && data.checkout_url) {
        return {
          success: true,
          checkoutId: String(data.id),
          checkoutUrl: String(data.checkout_url),
          status: String(data.status || "pending"),
        };
      }

      return {
        success: false,
        errorCode: String(data.code || response.status),
        errorMessage: String(data.message || "Chargily checkout creation failed"),
      };
    } catch (err) {
      return {
        success: false,
        errorCode: "NETWORK_ERROR",
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Retrieves checkout session status (/checkouts/:id).
   */
  public async getCheckoutSession(checkoutId: string): Promise<ChargilyCheckoutSession | null> {
    if (!this.isLiveMode) {
      return {
        id: checkoutId,
        status: "paid",
        amount: 5000,
        currency: "dzd",
        checkoutUrl: `${this.apiUrl}/redirect/checkout/${checkoutId}`,
      };
    }

    try {
      const response = await fetch(`${this.apiUrl}/checkouts/${checkoutId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.secretKey}`,
          "Accept": "application/json",
        },
      });

      if (!response.ok) return null;

      const data = await response.json() as Record<string, unknown>;
      return {
        id: String(data.id),
        status: String(data.status),
        amount: Number(data.amount || 0),
        currency: String(data.currency || "dzd"),
        checkoutUrl: String(data.checkout_url || ""),
        metadata: data.metadata as Record<string, unknown>,
      };
    } catch {
      return null;
    }
  }

  /**
   * Verifies Chargily Pay V2 HMAC-SHA256 signature (x-chargily-signature).
   */
  public verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    if (!signatureHeader || !this.secretKey) return false;
    try {
      const computedHmac = crypto.createHmac("sha256", this.secretKey).update(rawBody, "utf8").digest("hex");
      return crypto.timingSafeEqual(Buffer.from(computedHmac, "hex"), Buffer.from(signatureHeader, "hex"));
    } catch {
      return false;
    }
  }
}
