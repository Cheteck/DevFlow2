/**
 * @mosaix/plugin-engine/management — Marketplace Registry, Semver Resolution & Signature Verification
 */

import type { PluginManifest } from "../core/index.js";
import * as crypto from "crypto";

export interface MarketplacePackage {
  id: string;
  name: string;
  description: string;
  author: string;
  versions: Record<string, {
    manifest: PluginManifest;
    tarballUrl: string;
    integrity: string; // sha256 checksum
    signature: string; // Cryptographic publisher signature
    publishedAt: string;
  }>;
  latestVersion: string;
  tags: string[];
  downloadsCount: number;
  verifiedPublisher: boolean;
}

export class PluginMarketplaceRegistry {
  private remotePackages = new Map<string, MarketplacePackage>();
  private trustedPublicKeys = new Map<string, string>(); // publisherId -> publicKey

  registerPublisherKey(publisherId: string, publicKeyOrSecret: string): void {
    this.trustedPublicKeys.set(publisherId, publicKeyOrSecret);
  }

  publishPackage(pkg: MarketplacePackage): void {
    this.remotePackages.set(pkg.id, pkg);
  }

  /**
   * Search remote index with keywords and tags
   */
  search(query?: string, tag?: string): MarketplacePackage[] {
    const list = Array.from(this.remotePackages.values());
    return list.filter((p) => {
      if (tag && !p.tags.includes(tag)) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          p.id.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }

  /**
   * Resolve best matching semver version for a package (e.g. "^1.2.0" or "latest")
   */
  resolveVersion(packageId: string, versionRange: string = "latest"): {
    version: string;
    manifest: PluginManifest;
    tarballUrl: string;
    integrity: string;
    signature: string;
  } | undefined {
    const pkg = this.remotePackages.get(packageId);
    if (!pkg) return undefined;

    if (versionRange === "latest") {
      const v = pkg.latestVersion;
      const verData = pkg.versions[v];
      return verData ? { version: v, ...verData } : undefined;
    }

    // Simple semver matching support (^x.y.z, ~x.y.z, exact)
    const availableVersions = Object.keys(pkg.versions).sort((a, b) => this.compareVersions(b, a));

    if (versionRange.startsWith("^")) {
      const major = parseInt(versionRange.slice(1).split(".")[0], 10);
      const match = availableVersions.find((v) => parseInt(v.split(".")[0], 10) === major);
      if (match) return { version: match, ...pkg.versions[match] };
    } else if (versionRange.startsWith("~")) {
      const parts = versionRange.slice(1).split(".");
      const major = parseInt(parts[0], 10);
      const minor = parseInt(parts[1], 10);
      const match = availableVersions.find((v) => {
        const p = v.split(".");
        return parseInt(p[0], 10) === major && parseInt(p[1], 10) === minor;
      });
      if (match) return { version: match, ...pkg.versions[match] };
    }

    // Exact match
    if (pkg.versions[versionRange]) {
      return { version: versionRange, ...pkg.versions[versionRange] };
    }

    return undefined;
  }

  /**
   * Verify package cryptographic signature and checksum integrity
   */
  verifyPackage(
    manifest: PluginManifest,
    tarballContent: Buffer | string,
    integrityChecksum: string,
    signature: string,
    publisherId: string
  ): { valid: boolean; error?: string } {
    // 1. Verify SHA-256 Checksum
    const calculatedChecksum = crypto.createHash("sha256").update(tarballContent).digest("hex");
    if (integrityChecksum && calculatedChecksum !== integrityChecksum) {
      return {
        valid: false,
        error: `Integrity checksum mismatch: expected [${integrityChecksum}], got [${calculatedChecksum}]`,
      };
    }

    // 2. Verify Publisher Signature if key is registered
    const key = this.trustedPublicKeys.get(publisherId);
    if (key) {
      const expectedSig = crypto.createHmac("sha256", key).update(calculatedChecksum).digest("hex");
      if (signature !== expectedSig) {
        return {
          valid: false,
          error: `Cryptographic signature verification failed for publisher [${publisherId}].`,
        };
      }
    }

    return { valid: true };
  }

  private compareVersions(v1: string, v2: string): number {
    const p1 = v1.split(".").map((n) => parseInt(n, 10) || 0);
    const p2 = v2.split(".").map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const num1 = p1[i] ?? 0;
      const num2 = p2[i] ?? 0;
      if (num1 !== num2) return num1 - num2;
    }
    return 0;
  }
}
