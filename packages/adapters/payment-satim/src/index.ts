import * as crypto from "node:crypto";

export interface SatimAdapterOptions {
  gatewayUrl?: string; // e.g. "https://test.satim.dz/payment/rest"
  terminalId?: string; // e.g. "MOSAIX_TERM_01"
  userName?: string;
  password?: string;
  webhookSecret?: string;
  isLiveMode?: boolean;
}

export interface SatimRegisterOrderInput {
  orderId: string;
  amountInCents: number;
  currency?: string;
  returnUrl?: string;
  failUrl?: string;
  description?: string;
  idempotenceKey?: string;
}

export interface SatimRegisterOrderResult {
  success: boolean;
  satimOrderId?: string;
  formUrl?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface SatimOrderStatusResult {
  success: boolean;
  orderStatus: "CREATED" | "APPROVED" | "DECLINED" | "REFUNDED" | "UNKNOWN";
  amountInCents?: number;
  actionCode?: string;
  errorMessage?: string;
}

export class SatimPaymentAdapter {
  private readonly gatewayUrl: string;
  private readonly terminalId: string;
  private readonly userName: string;
  private readonly password: string;
  private readonly webhookSecret: string;
  private readonly isLiveMode: boolean;

  constructor(options: SatimAdapterOptions = {}) {
    this.gatewayUrl = options.gatewayUrl || "https://test.satim.dz/payment/rest";
    this.terminalId = options.terminalId || "MOSAIX_TERM_01";
    this.userName = options.userName || "mosaix_satim_merchant";
    this.password = options.password || "mosaix_satim_password";
    this.webhookSecret = options.webhookSecret || "mosaix_satim_webhook_secret_key_2026";
    this.isLiveMode = options.isLiveMode ?? false;
  }

  /**
   * Registers a payment order on SATIM Gateway (register.do).
   */
  public async registerOrder(input: SatimRegisterOrderInput): Promise<SatimRegisterOrderResult> {
    const returnUrl = input.returnUrl || `https://mosaix.platform/api/payments/satim-callback?id=${input.orderId}`;

    if (!this.isLiveMode) {
      // Simulator / Dev mode response
      const satimOrderId = `satim_${crypto.randomUUID()}`;
      const formUrl = `${this.gatewayUrl}/redirect.do?satimId=${satimOrderId}&order=${input.orderId}`;
      return {
        success: true,
        satimOrderId,
        formUrl,
      };
    }

    try {
      const endpoint = `${this.gatewayUrl}/register.do`;
      const params = new URLSearchParams({
        userName: this.userName,
        password: this.password,
        terminalId: this.terminalId,
        orderNumber: input.orderId,
        amount: String(input.amountInCents),
        currency: input.currency || "012", // 012 = DZD (Algerian Dinar ISO 4217)
        returnUrl,
        failUrl: input.failUrl || returnUrl,
        description: input.description || `MosaiX Order ${input.orderId}`,
      });

      const response = await fetch(`${endpoint}?${params.toString()}`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      const data = await response.json() as Record<string, unknown>;

      if (data.orderId && data.formUrl) {
        return {
          success: true,
          satimOrderId: String(data.orderId),
          formUrl: String(data.formUrl),
        };
      }

      return {
        success: false,
        errorCode: String(data.errorCode || "UNKNOWN"),
        errorMessage: String(data.errorMessage || "SATIM order registration failed"),
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
   * Queries SATIM Gateway for transaction approval status (getOrderStatus.do).
   */
  public async getOrderStatus(satimOrderId: string): Promise<SatimOrderStatusResult> {
    if (!this.isLiveMode) {
      return {
        success: true,
        orderStatus: "APPROVED",
        actionCode: "00",
      };
    }

    try {
      const endpoint = `${this.gatewayUrl}/getOrderStatus.do`;
      const params = new URLSearchParams({
        userName: this.userName,
        password: this.password,
        orderId: satimOrderId,
      });

      const response = await fetch(`${endpoint}?${params.toString()}`, { method: "GET" });
      const data = await response.json() as Record<string, unknown>;

      const status = Number(data.OrderStatus);
      let orderStatus: SatimOrderStatusResult["orderStatus"] = "UNKNOWN";

      if (status === 2) orderStatus = "APPROVED";
      else if (status === 0 || status === 1) orderStatus = "CREATED";
      else if (status === 3 || status === 6) orderStatus = "DECLINED";
      else if (status === 4) orderStatus = "REFUNDED";

      return {
        success: true,
        orderStatus,
        amountInCents: Number(data.Amount || 0),
        actionCode: String(data.actionCode || ""),
      };
    } catch (err) {
      return {
        success: false,
        orderStatus: "UNKNOWN",
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Refunds a SATIM transaction (refund.do).
   */
  public async refund(satimOrderId: string, amountInCents: number): Promise<{ success: boolean; errorMessage?: string }> {
    if (!this.isLiveMode) {
      return { success: true };
    }

    try {
      const endpoint = `${this.gatewayUrl}/refund.do`;
      const params = new URLSearchParams({
        userName: this.userName,
        password: this.password,
        orderId: satimOrderId,
        amount: String(amountInCents),
      });

      const response = await fetch(`${endpoint}?${params.toString()}`, { method: "GET" });
      const data = await response.json() as Record<string, unknown>;

      if (data.errorCode === "0" || data.errorCode === 0) {
        return { success: true };
      }

      return {
        success: false,
        errorMessage: String(data.errorMessage || "SATIM refund failed"),
      };
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Verifies HMAC-SHA256 signature for SATIM webhook notifications.
   */
  public verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    if (!signatureHeader || !this.webhookSecret) return false;
    try {
      const hmac = crypto.createHmac("sha256", this.webhookSecret).update(rawBody, "utf8").digest("hex");
      return crypto.timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(signatureHeader, "hex"));
    } catch {
      return false;
    }
  }
}
