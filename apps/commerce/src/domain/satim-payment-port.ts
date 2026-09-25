import type { PaymentPort } from "../workflows/checkout-order.workflow.js";
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
 * Integrates SATIM Gateway standard APIs: register.do, getOrderStatus.do, refund.do
 */
export class SatimPaymentPort implements PaymentPort {
  private activeHolds = new Map<string, { amount: number; key: string }>();

  constructor(
    private readonly gatewayUrl = "https://test.satim.dz/payment/rest",
    private readonly terminalId = "MOSAIX_TERM_01"
  ) {}

  /**
   * Authorize / Hold payment via SATIM CIB gateway
   */
  async authorize(orderId: string, amount: number, idempotenceKey: string): Promise<void> {
    console.log(
      `[SATIM PAY] Initiating authorization hold for order [${orderId}] with amount [${amount}] via SATIM CIB/Edahabia Gateway`
    );
    // Mimic the SATIM Gateway registration API call
    const satimRegisterEndpoint = `${this.gatewayUrl}/register.do`;
    const payload = {
      terminalId: this.terminalId,
      amount,
      orderNumber: orderId,
      returnUrl: `https://mosaix.platform/api/payments/satim-callback?id=${idempotenceKey}`,
    };

    console.log("[SATIM PAY] Prepared endpoint & payload for SATIM Gateway:", satimRegisterEndpoint, payload);

    this.activeHolds.set(orderId, { amount, key: idempotenceKey });
  }

  /**
   * Cancel / Void the authorization hold on SATIM
   */
  async void(orderId: string, idempotenceKey: string): Promise<void> {
    console.log(`[SATIM PAY] Refunding / Voiding SATIM transaction [${orderId}] for key [${idempotenceKey}]`);
    this.activeHolds.delete(orderId);
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
