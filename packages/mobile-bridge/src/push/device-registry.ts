export type MobilePlatform = "android" | "ios" | "harmony";

export interface MobileDeviceRegistration {
  userId: string;
  deviceId: string;
  fcmToken: string;
  platform: MobilePlatform;
  appVersion?: string;
  osVersion?: string;
  deviceModel?: string;
  subscribedTopics?: string[];
  registeredAt: Date;
  lastActiveAt: Date;
}

/**
 * Mobile Device Registry for FCM/Push token management
 */
export class DeviceRegistry {
  private static devices = new Map<string, MobileDeviceRegistration>();

  /**
   * Registers or updates a device push token
   */
  public static register(device: Omit<MobileDeviceRegistration, "registeredAt" | "lastActiveAt">): MobileDeviceRegistration {
    const existing = this.devices.get(device.deviceId);
    const registration: MobileDeviceRegistration = {
      ...device,
      subscribedTopics: device.subscribedTopics || existing?.subscribedTopics || ["global_announcements"],
      registeredAt: existing ? existing.registeredAt : new Date(),
      lastActiveAt: new Date(),
    };

    this.devices.set(device.deviceId, registration);
    return registration;
  }

  /**
   * Unregisters a device by deviceId (e.g. on user logout)
   */
  public static unregister(deviceId: string): boolean {
    return this.devices.delete(deviceId);
  }

  /**
   * Retrieves all registered devices for a specific user
   */
  public static getDevicesForUser(userId: string): MobileDeviceRegistration[] {
    return Array.from(this.devices.values()).filter((d) => d.userId === userId);
  }

  /**
   * Subscribes a device to a topic (e.g. space updates, chat channel)
   */
  public static subscribeToTopic(deviceId: string, topic: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    if (!device.subscribedTopics) {
      device.subscribedTopics = [];
    }

    if (!device.subscribedTopics.includes(topic)) {
      device.subscribedTopics.push(topic);
    }
    return true;
  }

  /**
   * Unsubscribes a device from a topic
   */
  public static unsubscribeFromTopic(deviceId: string, topic: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device || !device.subscribedTopics) return false;

    device.subscribedTopics = device.subscribedTopics.filter((t) => t !== topic);
    return true;
  }

  /**
   * Retrieves all device tokens subscribed to a topic
   */
  public static getTokensForTopic(topic: string): string[] {
    return Array.from(this.devices.values())
      .filter((d) => d.subscribedTopics?.includes(topic))
      .map((d) => d.fcmToken);
  }

  /**
   * Total registered devices count
   */
  public static count(): number {
    return this.devices.size;
  }
}
