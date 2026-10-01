import type { PaymentPort } from "../workflows/checkout-order.workflow.js";
import { SatimPaymentAdapter } from "@mosaix/adapter-payment-satim";
import { ChargilyPaymentAdapter } from "@mosaix/adapter-payment-chargily";
import { Money } from "@mosaix/core";

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
 * SatimPaymentPort - Implementation for SATIM CIB / Edahabia Card payments in Algeria (CIB-01).
 * Delegated to @mosaix/adapter-payment-satim.
 */
export class SatimPaymentPort implements PaymentPort {
  private readonly adapter: SatimPaymentAdapter;

  constructor(
    gatewayUrl = "https://test.satim.dz/payment/rest",
    terminalId = "MOSAIX_TERM_01"
  ) {
    this.adapter = new SatimPaymentAdapter({
      gatewayUrl,
      terminalId,
      isLiveMode: process.env.MOSAIX_FLAG_COMMERCE_PAYMENTS_SATIM_LIVE === "true",
    });
  }

  /**
   * Authorize / Hold payment via SATIM CIB gateway
   */
  async authorize(orderId: string, amount: number, idempotenceKey: string): Promise<void> {
    console.log(
      `[SATIM PAY] Initiating authorization hold for order [${orderId}] with amount [${amount}] via SATIM CIB/Edahabia Gateway`
    );

    const result = await this.adapter.registerOrder({
      orderId,
      amountInCents: amount,
      idempotenceKey,
    });

    if (!result.success) {
      throw new Error(`SATIM Authorization failed: ${result.errorMessage || result.errorCode}`);
    }

    console.log("[SATIM PAY] Prepared endpoint & payload for SATIM Gateway:", this.adapter, result);
  }

  /**
   * Cancel / Void the authorization hold on SATIM
   */
  async void(orderId: string, idempotenceKey: string): Promise<void> {
    console.log(`[SATIM PAY] Refunding / Voiding SATIM transaction [${orderId}] for key [${idempotenceKey}]`);
    await this.adapter.refund(orderId, 0);
  }
}

/**
 * ChargilyPaymentPort - Implementation for Chargily Pay V2 payments (CIB, Edahabia).
 * Delegated to @mosaix/adapter-payment-chargily.
 */
export class ChargilyPaymentPort implements PaymentPort {
  private readonly adapter: ChargilyPaymentAdapter;

  constructor(apiKey?: string, secretKey?: string) {
    this.adapter = new ChargilyPaymentAdapter({
      apiKey,
      secretKey,
      isLiveMode: process.env.MOSAIX_FLAG_COMMERCE_PAYMENTS_SATIM_LIVE === "true",
    });
  }

  async authorize(orderId: string, amount: number, idempotenceKey: string): Promise<void> {
    console.log(`[CHARGILY PAY] Creating checkout session for order [${orderId}] with amount [${amount}]`);

    const result = await this.adapter.createCheckoutSession({
      amountInCents: amount,
      orderId,
      successUrl: `https://mosaix.platform/api/payments/chargily-callback?id=${idempotenceKey}`,
    });

    if (!result.success) {
      throw new Error(`Chargily checkout creation failed: ${result.errorMessage || result.errorCode}`);
    }
  }

  async void(orderId: string, idempotenceKey: string): Promise<void> {
    console.log(`[CHARGILY PAY] Voiding checkout session for order [${orderId}] (idemp: ${idempotenceKey})`);
  }
}

/**
 * WalletEscrowManager - Handles the transaction flows for platform escrow:
 * recharge -> escrow_hold -> escrow_release with platform commission deduction
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
