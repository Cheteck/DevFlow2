/**
 * @apps/citadelle — MFA Service tests
 */

import { describe, it, expect } from "vitest";
import { MfaService, MfaError } from "./mfa-service.js";
import { User } from "./user.js";
import type { UserRepository } from "./user-service.js";
import type { CryptoPort } from "@mosaix/ports-crypto";
import type { ClockPort } from "@mosaix/ports-clock";
import type { SecretsPort } from "@mosaix/ports-secrets";
import type { LoggingPort } from "@mosaix/ports-logging";
import type { OtpService } from "@mosaix/otp";
import type { TotpVerifyResult } from "@mosaix/otp";

// --- Mocks ---

class MockCryptoPort implements CryptoPort {
  async hash(data: string | Buffer, algorithm?: string): Promise<string> {
    return Buffer.from(data as Buffer).toString("hex");
  }
  async hmac(data: string | Buffer, secret: string, algorithm?: string): Promise<string> {
    return "hmac-" + Buffer.from(data as Buffer).toString("hex").slice(0, 8);
  }
  async encrypt(data: string | Buffer, key: Buffer): Promise<{ ciphertext: Buffer; iv: Buffer; tag?: Buffer }> {
    const iv = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const ciphertext = Buffer.from(data as Buffer);
    return { ciphertext, iv, tag: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]) };
  }
  async decrypt(ciphertext: Buffer, key: Buffer, iv: Buffer, tag?: Buffer): Promise<Buffer> {
    return ciphertext;
  }
  async sign(data: string | Buffer, privateKey: string): Promise<Buffer> {
    return Buffer.from("signature");
  }
  async verify(data: string | Buffer, signature: Buffer, publicKey: string): Promise<boolean> {
    return true;
  }
  randomBytes(length: number): Buffer {
    return Buffer.alloc(length, 0x42);
  }
  async verifyPassword(password: string, expectedHash: string, salt?: string): Promise<boolean> {
    return password === "test-password";
  }
  timingSafeEqual(a: string | Buffer, b: string | Buffer): boolean {
    const bufA = typeof a === "string" ? Buffer.from(a, "utf-8") : a;
    const bufB = typeof b === "string" ? Buffer.from(b, "utf-8") : b;
    if (bufA.length !== bufB.length) return false;
    return bufA.equals(bufB);
  }
}

class MockClockPort implements ClockPort {
  private _now: number;
  constructor(startTime: number = 1000000000) {
    this._now = startTime;
  }
  now(): Date {
    return new Date(this._now);
  }
  advance(ms: number) {
    this._now += ms;
  }
}

class MockSecretsPort implements SecretsPort {
  private secrets: Map<string, string> = new Map();
  async getSecret(key: string): Promise<string | undefined> {
    return this.secrets.get(key);
  }
  async getRequiredSecret(key: string): Promise<string> {
    const val = this.secrets.get(key);
    if (!val) throw new Error(`Secret not found: ${key}`);
    return val;
  }
  setSecret(key: string, value: string) {
    this.secrets.set(key, value);
  }
}

class MockLoggingPort implements LoggingPort {
  debug(message: string, meta?: Record<string, unknown>): void {}
  info(message: string, meta?: Record<string, unknown>): void {}
  warn(message: string, meta?: Record<string, unknown>): void {}
  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {}
}

class MockOtpService implements OtpService {
  private _secret: string = "JBSWY3DPEHPK3PXP";
  private _verified = false;

  constructor(
    private repository: any,
    private delivery: any,
    private rateLimiter: any,
    private crypto: CryptoPort,
    private clock: ClockPort,
    private idGen: any,
    private secrets: SecretsPort,
    private logger: LoggingPort,
    private config: any,
    private policy: any,
  ) {}

  async generateTotpEnrollment(params: any): Promise<any> {
    return {
      provisioningUri: {
        uri: `otpauth://totp/${params.accountName}?secret=${this._secret}&issuer=${params.issuer}`,
        secret: this._secret,
      },
      secret: this._secret,
    };
  }

  async verifyTotp(params: {
    tenantId: string;
    userId: string;
    code: string;
    secret: string;
  }): Promise<TotpVerifyResult> {
    if (this._verified && params.code === "123456") {
      return { valid: true, matchedStep: 0 };
    }
    return { valid: false, reason: "INVALID_CODE" };
  }

  setVerified(verified: boolean) {
    this._verified = verified;
  }
}

class MockUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }
  async findByEmail(email: string): Promise<User | null> {
    for (const u of this.users.values()) {
      if (u.email === email) return u;
    }
    return null;
  }
  async save(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }
  async delete(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  addUser(user: User) {
    this.users.set(user.id, user);
  }
}

describe("MfaService", () => {
  let cryptoPort: MockCryptoPort;
  let clockPort: MockClockPort;
  let secretsPort: MockSecretsPort;
  let loggingPort: MockLoggingPort;
  let otpService: MockOtpService;
  let userRepository: MockUserRepository;
  let mfaService: MfaService;

  beforeEach(() => {
    cryptoPort = new MockCryptoPort();
    clockPort = new MockClockPort();
    secretsPort = new MockSecretsPort();
    loggingPort = new MockLoggingPort();
    otpService = new MockOtpService(
      null as any, null as any, null as any,
      cryptoPort, clockPort, null as any, secretsPort, loggingPort,
      null as any, null as any,
    );
    userRepository = new MockUserRepository();
    mfaService = new MfaService(
      otpService,
      userRepository,
      cryptoPort,
      clockPort,
      secretsPort,
      loggingPort,
    );
  });

  it("enrolls a TOTP vendable and returns provisioning URI", async () => {
    const user = new User("user-1", "alice@example.com", "Alice");
    userRepository.addUser(user);

    const result = await mfaService.enrollTotp({
      userId: "user-1",
      tenantId: "tenant-1",
      accountName: "alice@example.com",
      issuer: "Mosaix",
    });

    expect(result.provisioningUri.uri).toMatch(/otpauth:\/\/totp\//);
    expect(result.provisioningUri.uri).toMatch(/secret=JBSWY3DPEHPK3PXP/);
    expect(result.secret).toBe("JBSWY3DPEHPK3PXP");
  });

  it("completes TOTP enrollment after verifying a code", async () => {
    const user = new User("user-1", "alice@example.com", "Alice");
    userRepository.addUser(user);

    const enrollment = await mfaService.enrollTotp({
      userId: "user-1",
      tenantId: "tenant-1",
      accountName: "alice@example.com",
      issuer: "Mosaix",
    });

    otpService.setVerified(true);
    const result = await mfaService.completeTotpEnrollment({
      userId: "user-1",
      tenantId: "tenant-1",
      code: "123456",
      secret: enrollment.secret,
    });

    expect(result.recoveryCodes).toHaveLength(8);
    result.recoveryCodes.forEach((code) => {
      expect(code).toMatch(/^[A-Z2-9]{8}$/);
    });

    const isEnabled = await mfaService.isMfaEnabled("user-1");
    expect(isEnabled).toBe(true);
  });

  it("rejects enrollment with invalid TOTP code", async () => {
    const user = new User("user-1", "alice@example.com", "Alice");
    userRepository.addUser(user);

    const enrollment = await mfaService.enrollTotp({
      userId: "user-1",
      tenantId: "tenant-1",
      accountName: "alice@example.com",
      issuer: "Mosaix",
    });

    await expect(
      mfaService.completeTotpEnrollment({
        userId: "user-1",
        tenantId: "tenant-1",
        code: "000000",
        secret: enrollment.secret,
      })
    ).rejects.toThrow(MfaError);
  });

  it("verifies TOTP login", async () => {
    const user = new User("user-1", "alice@example.com", "Alice");
    userRepository.addUser(user);

    const enrollment = await mfaService.enrollTotp({
      userId: "user-1",
      tenantId: "tenant-1",
      accountName: "alice@example.com",
      issuer: "Mosaix",
    });
    otpService.setVerified(true);
    await mfaService.completeTotpEnrollment({
      userId: "user-1",
      tenantId: "tenant-1",
      code: "123456",
      secret: enrollment.secret,
    });

    await mfaService.verifyTotpLogin({
      userId: "user-1",
      tenantId: "tenant-1",
      code: "123456",
    });
  });

  it("rejects TOTP login with invalid code", async () => {
    const user = new User("user-1", "alice@example.com", "Alice");
    userRepository.addUser(user);

    const enrollment = await mfaService.enrollTotp({
      userId: "user-1",
      tenantId: "tenant-1",
      accountName: "alice@example.com",
      issuer: "Mosaix",
    });
    otpService.setVerified(true);
    await mfaService.completeTotpEnrollment({
      userId: "user-1",
      tenantId: "tenant-1",
      code: "123456",
      secret: enrollment.secret,
    });

    otpService.setVerified(false);

    await expect(
      mfaService.verifyTotpLogin({
        userId: "user-1",
        tenantId: "tenant-1",
        code: "000000",
      })
    ).rejects.toThrow(MfaError);
  });

  it("verifies and consumes a recovery code", async () => {
    const user = new User("user-1", "alice@example.com", "Alice");
    userRepository.addUser(user);

    const enrollment = await mfaService.enrollTotp({
      userId: "user-1",
      tenantId: "tenant-1",
      accountName: "alice@example.com",
      issuer: "Mosaix",
    });
    otpService.setVerified(true);
    const result = await mfaService.completeTotpEnrollment({
      userId: "user-1",
      tenantId: "tenant-1",
      code: "123456",
      secret: enrollment.secret,
    });

    const recoveryCode = result.recoveryCodes[0];

    // Verify the code succeeds
    await mfaService.verifyRecoveryCode({
      userId: "user-1",
      tenantId: "tenant-1",
      code: recoveryCode,
    });

    // Verify an invalid code fails
    await expect(
      mfaService.verifyRecoveryCode({
        userId: "user-1",
        tenantId: "tenant-1",
        code: "INVALIDCODE123",
      })
    ).rejects.toThrow(MfaError);
  });
});
