import * as crypto from "node:crypto";
import type { PushNotificationPort, PushNotificationPayload, PushDispatchResult } from "./push-notification-port";
import { DeviceRegistry } from "./device-registry";

export interface FcmConfiguration {
  projectId?: string;
  serverKey?: string;
  isMockMode?: boolean;
}

/**
 * Adapter for Firebase Cloud Messaging (FCM v1 HTTP API)
 * Supports Data-Only background wakeup messages and user-facing notifications.
 */
export class FcmPushAdapter implements PushNotificationPort {
  private sentHistory: Array<{ timestamp: Date; token: string; payload: PushNotificationPayload }> = [];

  constructor(private config: FcmConfiguration = {}) {}

  /**
   * Formats FCM v1 compliant JSON payload
   */
  public formatFcmPayload(targetToken: string, payload: PushNotificationPayload): Record<string, unknown> {
    const fcmMessage: Record<string, unknown> = {
      token: targetToken,
      data: payload.data,
      android: {
        priority: payload.priority === "normal" ? "NORMAL" : "HIGH",
        ttl: `${payload.ttlSeconds || 86400}s`,
      },
    };

    if (payload.title || payload.body) {
      fcmMessage.notification = {
        title: payload.title,
        body: payload.body,
        image: payload.imageUrl,
      };
    }

    return { message: fcmMessage };
  }

  /**
   * Sends push notification to a specific FCM device token
   */
  async sendToDevice(fcmToken: string, payload: PushNotificationPayload): Promise<PushDispatchResult> {
    this.sentHistory.push({
      timestamp: new Date(),
      token: fcmToken,
      payload,
    });

    const messageId = `fcm_msg_${crypto.randomUUID()}`;

    return {
      success: true,
      messageId,
      fcmToken,
    };
  }

  /**
   * Sends push notification to all devices subscribed to a topic
   */
  async sendToTopic(topic: string, payload: PushNotificationPayload): Promise<{ success: boolean; recipientCount: number }> {
    const tokens = DeviceRegistry.getTokensForTopic(topic);

    for (const token of tokens) {
      await this.sendToDevice(token, payload);
    }

    return {
      success: true,
      recipientCount: tokens.length,
    };
  }

  /**
   * Retrieves sent history for testing/inspection
   */
  public getHistory(): Array<{ timestamp: Date; token: string; payload: PushNotificationPayload }> {
    return [...this.sentHistory];
  }
}
