/**
 * @apps/portfolio/domain — GDPR-Compliant Shop Visit & Traffic Analytics Service
 * FEAT-09: Compteur de visites [CŒUR + plugin affichage] (portfolio + telemetry)
 */

import * as crypto from "node:crypto";

export interface PageVisitRecord {
  spaceId: string;
  vendableId?: string;
  route: string;
  anonymizedVisitorHash: string;
  dayKey: string; // YYYY-MM-DD
  timestamp: string;
  referrer?: string;
}

export interface TrafficSummary {
  spaceId: string;
  vendableId?: string;
  period: "today" | "last_7_days" | "last_30_days" | "all_time";
  totalVisits: number;
  uniqueVisitors: number;
  topReferrers: Array<{ referrer: string; count: number }>;
}

const KNOWN_BOT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /crawling/i,
  /googlebot/i,
  /bingbot/i,
  /slurp/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /sogou/i,
  /exabot/i,
  /facebookexternalhit/i,
];

export class ShopAnalyticsService {
  private visits: PageVisitRecord[] = [];
  private dailySalt = crypto.randomBytes(16).toString("hex");
  private lastSaltRotation = new Date().getUTCDate();

  private rotateSaltIfNeeded(): void {
    const currentDay = new Date().getUTCDate();
    if (currentDay !== this.lastSaltRotation) {
      this.dailySalt = crypto.randomBytes(16).toString("hex");
      this.lastSaltRotation = currentDay;
    }
  }

  /**
   * Generates a 1-way anonymized daily hash complying with GDPR
   */
  hashVisitor(ip: string, userAgent: string): string {
    this.rotateSaltIfNeeded();
    return crypto
      .createHash("sha256")
      .update(`${ip}:${userAgent}:${this.dailySalt}`)
      .digest("hex")
      .substring(0, 16);
  }

  isBot(userAgent: string): boolean {
    if (!userAgent) return false;
    return KNOWN_BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
  }

  recordVisit(params: {
    spaceId: string;
    vendableId?: string;
    route: string;
    ip?: string;
    userAgent?: string;
    referrer?: string;
  }): boolean {
    const ua = params.userAgent || "";
    if (this.isBot(ua)) {
      return false; // Exclude crawlers and scrapers
    }

    const visitorHash = this.hashVisitor(params.ip || "127.0.0.1", ua);
    const now = new Date();
    const dayKey = now.toISOString().split("T")[0];

    this.visits.push({
      spaceId: params.spaceId,
      vendableId: params.vendableId,
      route: params.route,
      anonymizedVisitorHash: visitorHash,
      dayKey,
      timestamp: now.toISOString(),
      referrer: params.referrer ? new URL(params.referrer, "http://localhost").hostname : undefined,
    });

    return true;
  }

  getTrafficSummary(
    spaceId: string,
    period: "today" | "last_7_days" | "last_30_days" | "all_time" = "last_7_days",
    vendableId?: string
  ): TrafficSummary {
    const now = new Date();
    let cutoffDate = new Date(0);

    if (period === "today") {
      cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "last_7_days") {
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "last_30_days") {
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const filtered = this.visits.filter((v) => {
      if (v.spaceId !== spaceId) return false;
      if (vendableId && v.vendableId !== vendableId) return false;
      return new Date(v.timestamp) >= cutoffDate;
    });

    const uniqueSet = new Set<string>();
    const referrerCounts = new Map<string, number>();

    for (const v of filtered) {
      uniqueSet.add(v.anonymizedVisitorHash);
      if (v.referrer && v.referrer !== "localhost") {
        referrerCounts.set(v.referrer, (referrerCounts.get(v.referrer) || 0) + 1);
      }
    }

    const topReferrers = Array.from(referrerCounts.entries())
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      spaceId,
      vendableId,
      period,
      totalVisits: filtered.length,
      uniqueVisitors: uniqueSet.size,
      topReferrers,
    };
  }
}

export const shopAnalyticsService = new ShopAnalyticsService();
