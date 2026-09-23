/**
 * @apps/spaces — Custom Domain DNS & SSL State Machine (GAP-01)
 */

export type DNSVerificationStatus = "UNVERIFIED" | "PENDING_DNS" | "VERIFIED" | "FAILED";
export type SSLCertificateStatus = "NONE" | "PROVISIONING" | "ACTIVE" | "EXPIRED" | "FAILED";

export interface CustomDomainRecord {
  domain: string;
  dnsStatus: DNSVerificationStatus;
  sslStatus: SSLCertificateStatus;
  verificationTxtRecord?: string;
  verifiedAt?: string;
  sslExpiresAt?: string;
}

export class SpaceCustomDomainEngine {
  static initiateDomainVerification(domain: string): CustomDomainRecord {
    return {
      domain,
      dnsStatus: "PENDING_DNS",
      sslStatus: "NONE",
      verificationTxtRecord: `mosaix-verification=${Math.random().toString(36).substring(2, 12)}`,
    };
  }

  static verifyDNS(record: CustomDomainRecord, success: boolean): CustomDomainRecord {
    if (!success) {
      return { ...record, dnsStatus: "FAILED" };
    }
    return {
      ...record,
      dnsStatus: "VERIFIED",
      verifiedAt: new Date().toISOString(),
      sslStatus: "PROVISIONING",
    };
  }

  static activateSSL(record: CustomDomainRecord, success: boolean): CustomDomainRecord {
    if (record.dnsStatus !== "VERIFIED") {
      throw new Error("Cannot activate SSL for an unverified DNS domain.");
    }
    if (!success) {
      return { ...record, sslStatus: "FAILED" };
    }
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    return {
      ...record,
      sslStatus: "ACTIVE",
      sslExpiresAt: expiresAt.toISOString(),
    };
  }
}
