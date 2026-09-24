import * as crypto from "node:crypto";
import type { MessageModel } from "./messaging.model.js";

export interface PushNotificationPayload {
  recipientId: string;
  conversationId: string;
  senderName: string;
  preview: string;
}

export class BeamPushDispatcher {
  private deviceTokens = new Map<string, Set<string>>(); // userId -> tokens

  registerToken(userId: string, token: string): void {
    if (!this.deviceTokens.has(userId)) {
      this.deviceTokens.set(userId, new Set());
    }
    this.deviceTokens.get(userId)!.add(token);
  }

  dispatch(payload: PushNotificationPayload): { sent: number; tokens: string[] } {
    const tokens = Array.from(this.deviceTokens.get(payload.recipientId) ?? []);
    return { sent: tokens.length, tokens };
  }
}

export interface UploadedChunk {
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  dataBase64: string;
}

export class BeamChunkedUploader {
  private uploads = new Map<string, { chunks: Map<number, string>; total: number; expiresAt: number }>();

  initiateUpload(totalChunks: number, ttlSeconds: number = 3600): string {
    const uploadId = `upl-${crypto.randomUUID()}`;
    this.uploads.set(uploadId, {
      chunks: new Map(),
      total: totalChunks,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return uploadId;
  }

  addChunk(chunk: UploadedChunk): boolean {
    const session = this.uploads.get(chunk.uploadId);
    if (!session || Date.now() > session.expiresAt) {
      throw new Error(`Upload session [${chunk.uploadId}] expired or invalid.`);
    }
    session.chunks.set(chunk.chunkIndex, chunk.dataBase64);
    return session.chunks.size === session.total;
  }
}

export class BeamMessageSearchEngine {
  static search(messages: MessageModel[], query: string, channelId?: string): MessageModel[] {
    const q = query.toLowerCase();
    return messages.filter((m) => {
      if (channelId && m.channelId !== channelId) return false;
      return m.content.toLowerCase().includes(q);
    });
  }
}

export interface AntivirusScanResult {
  clean: boolean;
  threatName?: string;
}

export class BeamAntivirusScanner {
  static async scanBuffer(buffer: Buffer): Promise<AntivirusScanResult> {
    // EICAR standard test signature detection
    const eicarSig = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
    if (buffer.toString("utf8").includes(eicarSig)) {
      return { clean: false, threatName: "EICAR-Test-Signature" };
    }
    return { clean: true };
  }
}

export class BeamDataRetentionManager {
  private static legalHolds = new Set<string>(); // set of channelIds with legal hold active

  static setLegalHold(channelId: string, hold: boolean): void {
    if (hold) {
      this.legalHolds.add(channelId);
    } else {
      this.legalHolds.delete(channelId);
    }
  }

  static isUnderLegalHold(channelId: string): boolean {
    return this.legalHolds.has(channelId);
  }

  static purgeExpired(messages: MessageModel[], retentionDays: number): MessageModel[] {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    return messages.filter((m) => {
      // Do not purge if under active legal hold
      if (this.isUnderLegalHold(m.channelId)) {
        return true;
      }
      return m.createdAt.getTime() >= cutoff;
    });
  }

  static exportGdprData(messages: MessageModel[], userId: string): string {
    const userMessages = messages.filter((m) => m.senderId === userId);
    return JSON.stringify(userMessages, null, 2);
  }
}

