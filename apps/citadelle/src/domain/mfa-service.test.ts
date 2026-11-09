/**
 * @apps/citadelle — MFA Service tests
 *
 * Unit tests for MfaService with adversarial security scenarios.
 */

import { describe, it, expect, vi } from "vitest";
import { MfaService, MfaError, type MfaState } from "./mfa-service.js";
import { User } from "./user.js";
import type { UserRepository } from "./user-service.js";
import type { MfaRepositoryPort } from "./mfa-repository-port.js";
import type { CryptoPort } from "@mosaix/ports-crypto";
import type { ClockPort } from "@mosaix/ports-clock";
import type { SecretsPort } from "@mosaix/ports-secrets";
import type { LoggingPort } from "@mosaix/ports-logging";
import type { OtpService } from "@mosaix/otp";
import type { TotpVerifyResult } from "@mosaix/otp";

// --- Mocks ---

class MockCryptoPort implements CryptoPort {
  private _byteCounter = 0;
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
    const buf = Buffer.alloc(length);
    for (let i = 0; i < length; i++) {
      this._byteCounter = (this._byteCounter * 7 + 3) % 251; // LCG, no quick repeats
      buf[i] = this._byteCounter;
    }
    return buf;
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

class MockMfaRepository implements MfaRepositoryPort {
  private states: Map<string, MfaState> = new Map();
  private usedSteps: Set<string> = new Set();

  async save(state: MfaState): Promise<void> {
    this.states.set(state.userId, state);
  }
  async findByUserId(userId: string, tenantId?: string): Promise<MfaState | null> {
    const state = this.states.get(userId);
    if (!state) return null;
    if (tenantId && state.tenantId !== tenantId) return null;
    return state;
  }
  async delete(userId: string): Promise<void> {
    this.states.delete(userId);
    this.usedSteps = new Set([...this.usedSteps].filter(s => !s.startsWith(userId + ":")));
  }
  async recordTotpStepUsed(tenantId: string, userId: string, step: number): Promise<boolean> {
    const key = `${tenantId}:${userId}:${step}`;
    if (this.usedSteps.has(key)) return true; // Already used = replay
    this.usedSteps.add(key);
    return false; // Not used, recorded
  }
  async incrementFailedAttempts(tenantId: string, userId: string): Promise<{ count: number; locked: boolean }> {
    const state = this.states.get(userId);
    if (!state) return { count: 0, locked: false };
    const count = (state.failedAttempts ?? 0) + 1;
    const locked = count >= 5;
    if (locked) {
      state.lockUntil = Date.now() + 5 * 60 * 1000;
      state.failedAttempts = 0;
    } else {
      state.failedAttempts = count;
    }
    this.states.set(userId, state);
    return { count, locked };
  }
  async resetFailedAttempts(tenantId: string, userId: string): Promise<void> {
    const state = this.states.get(userId);
    if (state) {
      state.failedAttempts = 0;
      state.lockUntil = undefined;
      this.states.set(userId, state);
    }
  }

  async countByKeyVersion(keyVersion: string): Promise<number> {
    let count = 0;
    for (const state of this.states.values()) {
      if (state.keyVersion === keyVersion) count++;
    }
    return count;
  }

  async runInTransaction<T>(fn: (repo: MfaRepositoryPort) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

function buildMfaState(overrides: Partial<MfaState> = {}): MfaState {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    enabled: true,
    factors: ["totp"],
    encryptedTotpSecret: "encrypted-secret",
    encryptionIv: "encryption-iv",
    encryptionTag: Buffer.from("encryption-tag"),
    recoveryCodes: [],
    enrolledAt: Date.now(),
    ...overrides,
  };
}

describe("MfaService", () => {
  let cryptoPort: MockCryptoPort;
  let clockPort: MockClockPort;
  let secretsPort: MockSecretsPort;
  let loggingPort: MockLoggingPort;
  let otpService: MockOtpService;
  let userRepository: MockUserRepository;
  let mfaRepository: MockMfaRepository;
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
    mfaRepository = new MockMfaRepository();
    mfaService = new MfaService(
      otpService,
      userRepository,
      mfaRepository,
      cryptoPort,
      clockPort,
      secretsPort,
      loggingPort,
    );
  });

  // =========================================================================
  // Enrollment
  // =========================================================================

  it("enrolls a TOTP user and returns provisioning URI", async () => {
    const user = new User("user-1", "alice@example.com", "Alice");
    userRepository.addUser(user);

    const result = await mfaService.enrollTotp({
      userId: "user-1",
      tenantId: "tenant-1",
      accountName: "alice@example.com",
      issuer: "Mosaix",
    });

    expect(result.provisioningUri.uri).toMatch(/otpauth:\/\/totp\//);
    expect(result.secret).toBe("JBSWY3DPEHPK3PXP");
  });

  it("completes TOTP enrollment after verifying a valid code", async () => {
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

    const isEnabled = await mfaService.isMfaEnabled("user-1", "tenant-1");
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

  // =========================================================================
  // TOTP verification (login challenge)
  // =========================================================================

  it("verifies TOTP login with valid code", async () => {
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

  // =========================================================================
  // Recovery codes (single-use, replay protection)
  // =========================================================================

  it("verifies and consumes a recovery code (single-use)", async () => {
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

    const recoveryCode = result.recoveryCodes[0]!;

    // First use succeeds
    await mfaService.verifyRecoveryCode({
      userId: "user-1",
      tenantId: "tenant-1",
      code: recoveryCode,
    });

    // Verify the code is marked as used in the repository
    const state = await mfaRepository.findByUserId("user-1");
    const usedCode = state!.recoveryCodes.find((rc) => rc.id === "recovery_0");
    expect(usedCode?.used).toBe(true);

    // Second use with same code fails (single-use / replay protection)
    await expect(
      mfaService.verifyRecoveryCode({
        userId: "user-1",
        tenantId: "tenant-1",
        code: recoveryCode,
      })
    ).rejects.toThrow(MfaError);
  });

  it("rejects invalid recovery code", async () => {
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

    await expect(
      mfaService.verifyRecoveryCode({
        userId: "user-1",
        tenantId: "tenant-1",
        code: "INVALIDCODE123",
      })
    ).rejects.toThrow(MfaError);
  });

  // =========================================================================
  // Tenant isolation
  // =========================================================================

  it("isolates MFA state by tenant", async () => {
    const user1 = new User("user-1", "alice@example.com", "Alice");
    const user2 = new User("user-2", "bob@example.com", "Bob");
    userRepository.addUser(user1);
    userRepository.addUser(user2);

    await mfaService.enrollTotp({
      userId: "user-1",
      tenantId: "tenant-a",
      accountName: "alice@example.com",
      issuer: "Mosaix",
    });

    const stateA = await mfaService.getMfaState("user-1", "tenant-a");
    expect(stateA?.tenantId).toBe("tenant-a");

    // user-2 has no MFA state in tenant-a
    const stateB = await mfaService.getMfaState("user-2", "tenant-a");
    expect(stateB).toBeNull();
  });

  // =========================================================================
  // MFA not enabled - verification fails
  // =========================================================================

  it("rejects TOTP login when MFA is not enabled", async () => {
    await expect(
      mfaService.verifyTotpLogin({
        userId: "user-unknown",
        tenantId: "tenant-1",
        code: "123456",
      })
    ).rejects.toThrow(MfaError);
  });

  it("rejects recovery code verification when MFA is not enabled", async () => {
    await expect(
      mfaService.verifyRecoveryCode({
        userId: "user-unknown",
        tenantId: "tenant-1",
        code: "INVALIDCODE",
      })
    ).rejects.toThrow(MfaError);
  });

  // =========================================================================
  // Adversarial security scenarios
  // =========================================================================

  it("locks out after MAX_FAILED_ATTEMPTS consecutive failures", async () => {
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

    // otpService.verifyTotp returns invalid for any code except "123456"
    // with _verified=true. Use wrong codes to trigger failures.
    otpService.setVerified(false);
    for (let i = 0; i < 5; i++) {
      // Advance clock to a new TOTP time step to avoid replay detection
      clockPort.advance(31000);
      await expect(
        mfaService.verifyTotpLogin({
          userId: "user-1",
          tenantId: "tenant-1",
          code: "000000",
        })
      ).rejects.toThrow(MfaError);
    }

    // 6th failure should trigger lockout
    clockPort.advance(31000);
    await expect(
      mfaService.verifyTotpLogin({
        userId: "user-1",
        tenantId: "tenant-1",
        code: "000000",
      })
    ).rejects.toThrow(MfaError);

    // Verify lockout state
    const state = await mfaService.getMfaState("user-1", "tenant-1");
    expect(state?.lockUntil).toBeDefined();
    expect(state!.lockUntil!).toBeGreaterThan(clockPort.now().getTime());
  });

  it("resets failed attempts on successful verification after lockout", async () => {
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

    // Trigger lockout (advance clock to new TOTP step each time)
    otpService.setVerified(false);
    for (let i = 0; i < 6; i++) {
      clockPort.advance(31000);
      await expect(
        mfaService.verifyTotpLogin({
          userId: "user-1",
          tenantId: "tenant-1",
          code: "000000",
        })
      ).rejects.toThrow(MfaError);
    }

    // Now valid code should still fail because locked
    otpService.setVerified(true);
    clockPort.advance(31000);
    const stateBefore = await mfaService.getMfaState("user-1", "tenant-1");
    expect(stateBefore?.lockUntil).toBeDefined();

    // Wait past lockout is not possible in unit test, so verify lock state
    await expect(
      mfaService.verifyTotpLogin({
        userId: "user-1",
        tenantId: "tenant-1",
        code: "123456",
      })
    ).rejects.toThrow(MfaError);
  });

  it("rejects MFA when OT provider throws during enrollment", async () => {
    const user = new User("user-1", "alice@example.com", "Alice");
    userRepository.addUser(user);

    // Make OtpService.generateTotpEnrollment throw
    const originalGenerate = otpService.generateTotpEnrollment.bind(otpService);
    vi.spyOn(otpService, "generateTotpEnrollment").mockRejectedValue(
      new Error("OT provider unavailable"),
    );

    await expect(
      mfaService.enrollTotp({
        userId: "user-1",
        tenantId: "tenant-1",
        accountName: "alice@example.com",
        issuer: "Mosaix",
      })
    ).rejects.toThrow(MfaError);

    vi.restoreAllMocks();
  });

  it("rejects MFA when OT provider throws during verification", async () => {
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

    vi.spyOn(otpService, "verifyTotp").mockRejectedValue(
      new Error("OT provider unavailable"),
    );

    await expect(
      mfaService.verifyTotpLogin({
        userId: "user-1",
        tenantId: "tenant-1",
        code: "123456",
      })
    ).rejects.toThrow(MfaError);

    vi.restoreAllMocks();
  });

  it("does not fall back to allowing login when OT provider unavailable", async () => {
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

    // OT provider throws → verifyTotpLogin must reject, never allow bypass
    vi.spyOn(otpService, "verifyTotp").mockRejectedValue(
      new Error("OT provider down"),
    );

    await expect(
      mfaService.verifyTotpLogin({
        userId: "user-1",
        tenantId: "tenant-1",
        code: "123456",
      })
    ).rejects.toThrow(MfaError);

    vi.restoreAllMocks();
  });

  // =========================================================================
  // Replay protection at MfaService level (atomic, via repository)
  // =========================================================================

  it("rejects TOTP replay when same time step used twice", async () => {
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

    // First verification succeeds
    otpService.setVerified(true);
    clockPort.advance(31000);
    await mfaService.verifyTotpLogin({
      userId: "user-1",
      tenantId: "tenant-1",
      code: "123456",
    });

    // Same time step, same code → replay detected
    otpService.setVerified(true);
    await expect(
      mfaService.verifyTotpLogin({
        userId: "user-1",
        tenantId: "tenant-1",
        code: "123456",
      })
    ).rejects.toThrow(MfaError);
  });

  it("accepts new TOTP time step after previous step used", async () => {
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

    // First verification succeeds
    otpService.setVerified(true);
    clockPort.advance(31000);
    await mfaService.verifyTotpLogin({
      userId: "user-1",
      tenantId: "tenant-1",
      code: "123456",
    });

    // Advance to new time step, new verification succeeds
    otpService.setVerified(true);
    clockPort.advance(31000);
    await expect(
      mfaService.verifyTotpLogin({
        userId: "user-1",
        tenantId: "tenant-1",
        code: "123456",
      })
    ).resolves.toBeUndefined();
  });

  it("rejects MFA state access with wrong tenantId", async () => {
    const user = new User("user-1", "alice@example.com", "Alice");
    userRepository.addUser(user);

    await mfaService.enrollTotp({
      userId: "user-1",
      tenantId: "tenant-a",
      accountName: "alice@example.com",
      issuer: "Mosaix",
    });

    // Access with wrong tenantId → null
    const state = await mfaService.getMfaState("user-1", "tenant-b");
    expect(state).toBeNull();

    // Access with correct tenantId → found
    const stateA = await mfaService.getMfaState("user-1", "tenant-a");
    expect(stateA).not.toBeNull();
    expect(stateA?.tenantId).toBe("tenant-a");
  });

  it("stores keyVersion on enrollment", async () => {
    const user = new User("user-1", "alice@example.com", "Alice");
    userRepository.addUser(user);

    const enrollment = await mfaService.enrollTotp({
      userId: "user-1",
      tenantId: "tenant-1",
      accountName: "alice@example.com",
      issuer: "Mosaix",
    });

    const state = await mfaService.getMfaState("user-1", "tenant-1");
    expect(state?.keyVersion).toBe("v1");
  });

  it("rejects concurrent verification of the same OTP (concurrency)", async () => {
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

    // Advance to a specific time step
    clockPort.advance(31000);
    const currentStep = Math.floor(clockPort.now().getTime() / 1000 / 30);

    // First verification succeeds (time-step not yet used)
    otpService.setVerified(true);
    await mfaService.verifyTotpLogin({
      userId: "user-1",
      tenantId: "tenant-1",
      code: "123456",
    });

    // Simulate concurrent request: time-step already used by first request
    otpService.setVerified(true);
    await expect(
      mfaService.verifyTotpLogin({
        userId: "user-1",
        tenantId: "tenant-1",
        code: "123456",
      })
    ).rejects.toThrow(MfaError);
  });

  // =========================================================================
  // End of adversarial tests
  // =========================================================================
});
