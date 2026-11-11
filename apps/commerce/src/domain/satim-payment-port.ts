import type { PaymentPort } from "../workflows/checkout-order.workflow.js";
import { Money, type Logger } from "@mosaix/core";
import * as crypto from "node:crypto";

export interface UnifiedPaymentPort extends PaymentPort {
  refund?(orderId: string, amount: number, idempotenceKey: string): Promise<void>;
  verifyWebhook?(signature: string, payload: unknown): boolean;
}

export interface SatimPaymentOptions {
  gatewayUrl?: string;
  terminalId?: string;
  returnUrlBase?: string;
  /** HMAC secret for webhook verification (env SATIM_WEBHOOK_SECRET). Absent → fail-closed. */
  webhookSecret?: string;
  logger?: Pick<Logger, "info" | "warn">;
}

/**
 * SatimPaymentPort - Implementation for SATIM CIB / Edahabia Card payments in Algeria (CIB-01).
 * Integrates SATIM Gateway standard APIs: register.do, getOrderStatus.do, refund.do
 *
 * Config via env (see `.env.example`, BOUND-02): `SATIM_GATEWAY_URL`,
 * `SATIM_TERMINAL_ID`, `MOSAIX_PUBLIC_BASE_URL`. Constructor params win
 * over env, for tests. Hardcoded values below are sandbox fallbacks only.
 *
 * NOTE: the live gateway call is not issued yet — the hold is recorded
 * locally (volatile `Map`). No secret material (terminal payload) is ever
 * logged. Full PSP extraction + persistence is tracked by BOUND-02.
 */
export class SatimPaymentPort implements UnifiedPaymentPort {
  private activeHolds = new Map<string, { amount: number; key: string }>();
  private readonly gatewayUrl: string;
  private readonly terminalId: string;
  private readonly returnUrlBase: string;
  private readonly webhookSecret: string;
  private readonly logger?: Pick<Logger, "info" | "warn">;

  constructor(options: SatimPaymentOptions = {}) {
    this.gatewayUrl =
      options.gatewayUrl ?? process.env.SATIM_GATEWAY_URL ?? "https://test.satim.dz/payment/rest";
    this.terminalId = options.terminalId ?? process.env.SATIM_TERMINAL_ID ?? "MOSAIX_TERM_01";
    this.returnUrlBase =
      options.returnUrlBase ?? process.env.MOSAIX_PUBLIC_BASE_URL ?? "https://mosaix.platform";
    this.webhookSecret = options.webhookSecret ?? process.env.SATIM_WEBHOOK_SECRET ?? "";
    this.logger = options.logger;
  }

  /**
   * Authorize / Hold payment via SATIM CIB gateway
   */
  async authorize(orderId: string, amount: number, idempotenceKey: string): Promise<void> {
    this.logger?.info("[satim] authorization hold requested", { orderId, amount });
    const satimRegisterEndpoint = `${this.gatewayUrl}/register.do`;
    const payload = {
      terminalId: this.terminalId,
      amount,
      orderNumber: orderId,
      returnUrl: `${this.returnUrlBase}/api/payments/satim-callback?id=${idempotenceKey}`,
    };

    // Deferred live call (BOUND-02): record the prepared hold locally.
    // The endpoint is kept for debuggability; secrets stay out of logs.
    this.logger?.warn("[satim] gateway call deferred — hold kept in memory (non-persistent)", {
      orderId,
      endpoint: satimRegisterEndpoint,
    });

    this.activeHolds.set(orderId, { amount, key: idempotenceKey });
    void payload;
  }

  /**
   * Cancel / Void the authorization hold on SATIM
   */
  async void(orderId: string, idempotenceKey: string): Promise<void> {
    this.logger?.info("[satim] authorization hold voided", { orderId, idempotenceKey });
    this.activeHolds.delete(orderId);
  }

  async refund(orderId: string, amount: number, idempotenceKey: string): Promise<void> {
    this.logger?.info("[satim] refund requested", { orderId, amount, idempotenceKey });
    this.activeHolds.delete(orderId);
  }

/* AUDIT-RESET a055b8e (2026-10-13) — HUNK PRÉSENT PUIS DURCI (V3.1, voir git log).
 * La garde `< 16 caractères` + `return true` est remplacée par une vérification HMAC-SHA256
 * fail-closed (voir verifyWebhook). Reste dû : alignement canonisation SATIM avant prod. */
  /**
   * Webhook authenticity (V3.1, BOUND-02): HMAC-SHA256 over the canonical
   * `JSON.stringify` of the payload, compared timing-safe against the
   * `x-satim-signature` header (`sha256=<hex>` or raw `<hex>`).
   * Fail-closed: no configured secret → false, never true.
   * Production MUST align the canonicalization with the SATIM signing spec
   * before going live (see release gate); unit cover lives in
   * `satim-webhook.test.ts`.
   */
  verifyWebhook(signature: string, payload: unknown): boolean {
    if (!this.webhookSecret || !signature) return false;
    const clean = signature.startsWith("sha256=") ? signature.slice("sha256=".length) : signature;
    let presented: Buffer;
    try {
      presented = Buffer.from(clean, "hex");
    } catch {
      return false;
    }
    if (presented.length !== 32) return false;
    const expected = crypto.createHmac("sha256", this.webhookSecret).update(JSON.stringify(payload)).digest();
    return crypto.timingSafeEqual(presented, expected);
  }
}

export interface Wallet {
  id: string;
  ownerId: string;
  ownerType: "space" | "tenant" | "user";
  balanceInCents: number;
  currency: string;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: "escrow_hold" | "escrow_release" | "payout" | "recharge";
  amountInCents: number;
  orderId?: string;
  timestamp: string;
}

/**
 * WalletEscrowManager - Handles the transaction flows for platform escrow:
 * recharge -> escrow_hold -> escrow_release with platform commission deduction.
 *
 * NOTE: state lives in process memory (volatile). Balances MUST move to
 * persistent ledger tables before production money flows (BOUND-02).
 */
export class WalletEscrowManager {
  private wallets = new Map<string, Wallet>();
  private transactions: WalletTransaction[] = [];

  getWallet(ownerId: string, ownerType: Wallet["ownerType"], currency = "DZD"): Wallet {
    const key = `${ownerType}:${ownerId}`;
    if (!this.wallets.has(key)) {
      this.wallets.set(key, {
        id: `wal-${key}`,
        ownerId,
        ownerType,
        balanceInCents: 0,
        currency,
      });
    }
    return this.wallets.get(key)!;
  }

  rechargeWallet(ownerId: string, ownerType: Wallet["ownerType"], amount: Money): void {
    const wallet = this.getWallet(ownerId, ownerType, amount.currency);
    wallet.balanceInCents += amount.amountInCents;
    this.transactions.push({
      id: `tx-${crypto.randomUUID()}`,
      walletId: wallet.id,
      type: "recharge",
      amountInCents: amount.amountInCents,
      timestamp: new Date().toISOString(),
    });
  }

  holdEscrow(buyerId: string, orderId: string, amount: Money): void {
    const buyerWallet = this.getWallet(buyerId, "user", amount.currency);
    if (buyerWallet.balanceInCents < amount.amountInCents) {
      throw new Error(`Insufficient wallet balance for escrow hold`);
    }
    buyerWallet.balanceInCents -= amount.amountInCents;
    this.transactions.push({
      id: `tx-${crypto.randomUUID()}`,
      walletId: buyerWallet.id,
      type: "escrow_hold",
      amountInCents: amount.amountInCents,
      orderId,
      timestamp: new Date().toISOString(),
    });
  }

  releaseEscrow(
    sellerId: string,
    sellerType: "space" | "tenant",
    orderId: string,
    amount: Money,
    commissionRateBps = 500 // 5.00% default
  ): void {
    const sellerWallet = this.getWallet(sellerId, sellerType, amount.currency);
    const commissionAmount = Math.round((amount.amountInCents * commissionRateBps) / 10000);
    const netSellerPayout = amount.amountInCents - commissionAmount;

    sellerWallet.balanceInCents += netSellerPayout;

    this.transactions.push({
      id: `tx-${crypto.randomUUID()}`,
      walletId: sellerWallet.id,
      type: "escrow_release",
      amountInCents: netSellerPayout,
      orderId,
      timestamp: new Date().toISOString(),
    });

    // Payout transaction
    this.transactions.push({
      id: `tx-${crypto.randomUUID()}`,
      walletId: sellerWallet.id,
      type: "payout",
      amountInCents: netSellerPayout,
      orderId,
      timestamp: new Date().toISOString(),
    });
  }

  listTransactions(): WalletTransaction[] {
    return [...this.transactions];
  }
}
