import * as crypto from "node:crypto";

export interface PasswordHasherPort {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

/**
 * Enterprise Scrypt Password Hasher Adapter
 * Compliant with OWASP Password Storage Guidelines (salt >= 16 bytes, N=16384, r=8, p=1, keylen=64)
 */
export class ScryptPasswordHasherAdapter implements PasswordHasherPort {
  private readonly saltLength = 16;
  private readonly keyLength = 64;

  async hash(password: string): Promise<string> {
    const salt = crypto.randomBytes(this.saltLength).toString("hex");
    return new Promise((resolve, reject) => {
      crypto.scrypt(password, salt, this.keyLength, (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`${salt}:${derivedKey.toString("hex")}`);
      });
    });
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const parts = storedHash.split(":");
    if (parts.length !== 2) return false;
    const [salt, key] = parts;

    return new Promise((resolve) => {
      crypto.scrypt(password, salt, this.keyLength, (err, derivedKey) => {
        if (err) return resolve(false);
        try {
          const keyBuffer = Buffer.from(key, "hex");
          const match = crypto.timingSafeEqual(keyBuffer, derivedKey);
          resolve(match);
        } catch {
          resolve(false);
        }
      });
    });
  }
}

/**
 * Account Lockout Guard for brute-force protection
 */
export interface LockoutPolicy {
  maxAttempts: number;
  lockoutDurationMs: number;
}

export class AccountLockoutGuard {
  private attempts = new Map<string, { count: number; lockedUntil?: number }>();
  private readonly policy: LockoutPolicy;

  constructor(policy: Partial<LockoutPolicy> = {}) {
    this.policy = {
      maxAttempts: policy.maxAttempts ?? 5,
      lockoutDurationMs: policy.lockoutDurationMs ?? 15 * 60 * 1000, // 15 min
    };
  }

  isLocked(identifier: string): { locked: boolean; remainingMs?: number } {
    const record = this.attempts.get(identifier);
    if (!record || !record.lockedUntil) {
      return { locked: false };
    }
    const now = Date.now();
    if (now >= record.lockedUntil) {
      this.attempts.delete(identifier);
      return { locked: false };
    }
    return { locked: true, remainingMs: record.lockedUntil - now };
  }

  recordFailure(identifier: string): { locked: boolean; attemptsLeft: number } {
    const now = Date.now();
    const record = this.attempts.get(identifier) || { count: 0 };
    record.count += 1;

    if (record.count >= this.policy.maxAttempts) {
      record.lockedUntil = now + this.policy.lockoutDurationMs;
      this.attempts.set(identifier, record);
      return { locked: true, attemptsLeft: 0 };
    }

    this.attempts.set(identifier, record);
    return { locked: false, attemptsLeft: this.policy.maxAttempts - record.count };
  }

  recordSuccess(identifier: string): void {
    this.attempts.delete(identifier);
  }
}
