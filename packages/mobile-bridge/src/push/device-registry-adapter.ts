import type { DatabasePort } from "@mosaix/ports-database";

export type MobilePlatform = "android" | "ios" | "harmony";

export interface MobileDeviceRegistration {
  deviceId: string;
  userId: string;
  fcmToken: string;
  platform: MobilePlatform;
  appVersion?: string;
  osVersion?: string;
  deviceModel?: string;
  subscribedTopics: string[];
  registeredAt: number;
  lastActiveAt: number;
}

export interface DeviceRegistryPort {
  register(device: Omit<MobileDeviceRegistration, "registeredAt" | "lastActiveAt" | "subscribedTopics"> & { subscribedTopics?: string[] }): Promise<MobileDeviceRegistration>;
  unregister(deviceId: string): Promise<boolean>;
  getDevicesForUser(userId: string): Promise<MobileDeviceRegistration[]>;
  subscribeToTopic(deviceId: string, topic: string): Promise<boolean>;
  unsubscribeFromTopic(deviceId: string, topic: string): Promise<boolean>;
  getTokensForTopic(topic: string): Promise<string[]>;
  count(): Promise<number>;
  updateLastActive(deviceId: string): Promise<void>;
}

export class DeviceRegistryAdapter implements DeviceRegistryPort {
  constructor(private readonly db: DatabasePort) {}

  async register(input: Omit<MobileDeviceRegistration, "registeredAt" | "lastActiveAt" | "subscribedTopics"> & { subscribedTopics?: string[] }): Promise<MobileDeviceRegistration> {
    const now = Date.now();
    const existing = await this.findById(input.deviceId);

    const registration: MobileDeviceRegistration = {
      ...input,
      subscribedTopics: input.subscribedTopics ?? existing?.subscribedTopics ?? ["global_announcements"],
      registeredAt: existing?.registeredAt ?? now,
      lastActiveAt: now,
    };

    await this.db.execute(
      `INSERT INTO mobile_devices (device_id, user_id, fcm_token, platform, app_version, os_version, device_model, subscribed_topics, registered_at, last_active_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET
         user_id = excluded.user_id,
         fcm_token = excluded.fcm_token,
         platform = excluded.platform,
         app_version = excluded.app_version,
         os_version = excluded.os_version,
         device_model = excluded.device_model,
         subscribed_topics = excluded.subscribed_topics,
         last_active_at = excluded.last_active_at`,
      [
        registration.deviceId,
        registration.userId,
        registration.fcmToken,
        registration.platform,
        registration.appVersion ?? null,
        registration.osVersion ?? null,
        registration.deviceModel ?? null,
        JSON.stringify(registration.subscribedTopics),
        registration.registeredAt,
        registration.lastActiveAt,
      ],
    );

    return registration;
  }

  async unregister(deviceId: string): Promise<boolean> {
    const result = await this.db.execute(`DELETE FROM mobile_devices WHERE device_id = ?`, [deviceId]);
    return (result ?? 0) > 0;
  }

  async getDevicesForUser(userId: string): Promise<MobileDeviceRegistration[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT device_id as deviceId, user_id as userId, fcm_token as fcmToken, platform, app_version as appVersion, os_version as osVersion, device_model as deviceModel, subscribed_topics as subscribedTopics, registered_at as registeredAt, last_active_at as lastActiveAt
       FROM mobile_devices WHERE user_id = ?`,
      [userId],
    );
    return rows.map((r) => ({
      deviceId: String(r.deviceId),
      userId: String(r.userId),
      fcmToken: String(r.fcmToken),
      platform: String(r.platform) as MobilePlatform,
      appVersion: r.appVersion ? String(r.appVersion) : undefined,
      osVersion: r.osVersion ? String(r.osVersion) : undefined,
      deviceModel: r.deviceModel ? String(r.deviceModel) : undefined,
      subscribedTopics: r.subscribedTopics ? JSON.parse(String(r.subscribedTopics)) : [],
      registeredAt: Number(r.registeredAt),
      lastActiveAt: Number(r.lastActiveAt),
    }));
  }

  private async findById(deviceId: string): Promise<MobileDeviceRegistration | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT device_id as deviceId, user_id as userId, fcm_token as fcmToken, platform, app_version as appVersion, os_version as osVersion, device_model as deviceModel, subscribed_topics as subscribedTopics, registered_at as registeredAt, last_active_at as lastActiveAt
       FROM mobile_devices WHERE device_id = ?`,
      [deviceId],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      deviceId: String(r.deviceId),
      userId: String(r.userId),
      fcmToken: String(r.fcmToken),
      platform: String(r.platform) as MobilePlatform,
      appVersion: r.appVersion ? String(r.appVersion) : undefined,
      osVersion: r.osVersion ? String(r.osVersion) : undefined,
      deviceModel: r.deviceModel ? String(r.deviceModel) : undefined,
      subscribedTopics: r.subscribedTopics ? JSON.parse(String(r.subscribedTopics)) : [],
      registeredAt: Number(r.registeredAt),
      lastActiveAt: Number(r.lastActiveAt),
    };
  }

  async subscribeToTopic(deviceId: string, topic: string): Promise<boolean> {
    const device = await this.findById(deviceId);
    if (!device) return false;

    if (!device.subscribedTopics.includes(topic)) {
      device.subscribedTopics.push(topic);
      await this.db.execute(
        `UPDATE mobile_devices SET subscribed_topics = ? WHERE device_id = ?`,
        [JSON.stringify(device.subscribedTopics), deviceId],
      );
    }
    return true;
  }

  async unsubscribeFromTopic(deviceId: string, topic: string): Promise<boolean> {
    const device = await this.findById(deviceId);
    if (!device || !device.subscribedTopics) return false;

    device.subscribedTopics = device.subscribedTopics.filter((t) => t !== topic);
    await this.db.execute(
      `UPDATE mobile_devices SET subscribed_topics = ? WHERE device_id = ?`,
      [JSON.stringify(device.subscribedTopics), deviceId],
    );
    return true;
  }

  async getTokensForTopic(topic: string): Promise<string[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT fcm_token as fcmToken FROM mobile_devices WHERE json_extract(subscribed_topics, '$') LIKE ?`,
      [`%${topic}%`],
    );
    return rows.map((r) => String(r.fcmToken));
  }

  async count(): Promise<number> {
    const rows = await this.db.query<{ count: number }>(`SELECT COUNT(*) as count FROM mobile_devices`);
    return rows[0]?.count ?? 0;
  }

  async updateLastActive(deviceId: string): Promise<void> {
    await this.db.execute(
      `UPDATE mobile_devices SET last_active_at = ? WHERE device_id = ?`,
      [Date.now(), deviceId],
    );
  }
}