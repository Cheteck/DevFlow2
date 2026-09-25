export interface PushNotificationPayload {
  title?: string;
  body?: string;
  imageUrl?: string;
  sound?: string;
  badge?: number;
  data: Record<string, string>; // Strings only for Android FCM compatibility
  priority?: "normal" | "high";
  ttlSeconds?: number;
}

export interface PushDispatchResult {
  success: boolean;
  messageId?: string;
  fcmToken: string;
  error?: string;
}

/**
 * Port interface for sending Push Notifications to mobile devices
 */
export interface PushNotificationPort {
  sendToDevice(fcmToken: string, payload: PushNotificationPayload): Promise<PushDispatchResult>;
  sendToTopic(topic: string, payload: PushNotificationPayload): Promise<{ success: boolean; recipientCount: number }>;
}
