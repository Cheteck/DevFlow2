/**
 * @mosaix/shell — PSP Payment Gateway Webhook Handler with Cryptographic Signature Verification
 * Handles Stripe / Adyen / Mollie style webhooks for order and recurring subscription updates.
 */

import * as crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { DistributedEventBackplane } from "./event-backplane.js";
import { sendProblemResponse } from "./http-errors.js";

export interface PspWebhookEvent {
  id: string;
  type: "payment_intent.succeeded" | "payment_intent.failed" | "invoice.paid" | "customer.subscription.updated" | "customer.subscription.deleted";
  data: {
    orderId?: string;
    userId?: string;
    planId?: string;
    amountInCents?: number;
    currency?: string;
    status?: string;
  };
  created: number;
}

export class PspWebhookHandler {
  private readonly eventBackplane = DistributedEventBackplane.getInstance();

  /**
   * Verifies HMAC-SHA256 signature for incoming webhooks.
   */
  verifySignature(rawBody: string, signatureHeader: string | undefined, secret: string): boolean {
    if (!signatureHeader || !secret) return false;

    try {
      // Support standard t=timestamp,v1=hash format or raw hex hash
      let signature = signatureHeader;
      if (signatureHeader.includes("v1=")) {
        const parts = signatureHeader.split(",");
        const v1Part = parts.find(p => p.startsWith("v1="));
        if (v1Part) {
          signature = v1Part.substring(3);
        }
      }

      const hmac = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
      return crypto.timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(signature, "hex"));
    } catch {
      return false;
    }
  }

  async handleWebhookRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let bodyStr = "";
    let receivedBytes = 0;
    const maxBytes = 512 * 1024; // 512 KB ceiling for webhooks

    req.on("data", chunk => {
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) {
        req.destroy();
        sendProblemResponse(res, 413, "Payload Too Large", "Taille du webhook supérieure à la limite autorisée.");
        return;
      }
      bodyStr += chunk;
    });

    req.on("end", async () => {
      try {
        const signatureHeader = (req.headers["x-psp-signature"] as string) || (req.headers["stripe-signature"] as string);
        const webhookSecret = process.env.PSP_WEBHOOK_SECRET || "mosaix_psp_webhook_secret_dev_key_2026";

        // VULN-04: Mandatory signature verification — do not allow bypass if header is omitted
        if (!signatureHeader) {
          sendProblemResponse(
            res,
            401,
            "Missing Signature",
            "L'en-tête de signature cryptographique (x-psp-signature ou stripe-signature) est obligatoire."
          );
          return;
        }

        const isValid = this.verifySignature(bodyStr, signatureHeader, webhookSecret);
        if (!isValid) {
          sendProblemResponse(res, 401, "Invalid Signature", "La signature cryptographique du webhook est invalide.");
          return;
        }

        const event = JSON.parse(bodyStr || "{}") as PspWebhookEvent;
        if (!event.type || !event.id) {
          sendProblemResponse(res, 400, "Invalid Webhook Event", "Payload de webhook non conforme.");
          return;
        }

        // Process event types and dispatch to bounded contexts via Event Backplane
        switch (event.type) {
          case "payment_intent.succeeded":
            this.eventBackplane.publish("commerce.order.paid", {
              orderId: event.data.orderId,
              amountInCents: event.data.amountInCents,
              currency: event.data.currency || "EUR",
              timestamp: event.created || Date.now(),
            });
            break;

          case "invoice.paid":
          case "customer.subscription.updated":
            this.eventBackplane.publish("subscription.user.updated", {
              userId: event.data.userId,
              planId: event.data.planId,
              status: "active",
              timestamp: event.created || Date.now(),
            });
            break;

          case "customer.subscription.deleted":
            this.eventBackplane.publish("subscription.user.cancelled", {
              userId: event.data.userId,
              planId: event.data.planId,
              status: "canceled",
              timestamp: event.created || Date.now(),
            });
            break;

          default:
            console.warn(`[PspWebhookHandler] Unhandled webhook event type: ${event.type}`);
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ received: true, eventId: event.id, processedAt: new Date().toISOString() }));
      } catch (err) {
        sendProblemResponse(res, 500, "Webhook Processing Failed", String(err));
      }
    });
  }
}

export const pspWebhookHandler = new PspWebhookHandler();
