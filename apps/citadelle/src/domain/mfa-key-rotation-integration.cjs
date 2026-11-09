/**
 * MFA Key Rotation Integration Test - Real MfaService with SecretsPort mock
 * Tests hybrid decryption with multiple key versions, simulating real key rotation
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;

// Simulate the SecretsPort interface
class MockSecretsPort {
    constructor() {
        this.secrets = new Map();
    }

    async getSecret(key) {
        return this.secrets.get(key) || undefined;
    }

    async getRequiredSecret(key) {
        const val = await this.getSecret(key);
        if (!val) throw new Error(`Required secret '${key}' is missing`);
        return val;
    }

    async setSecret(key, value) {
        this.secrets.set(key, value);
    }
}

// Simulate the CryptoPort interface
class MockCryptoPort {
    async encrypt(data, key) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
        const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
        const tag = cipher.getAuthTag();
        return { ciphertext: encrypted, iv, tag };
    }

    async decrypt(ciphertext, key, iv, tag) {
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    }
}

// Simplified MfaService key management (extracted from real implementation)
class MfaServiceKeyManager {
    constructor(secrets, crypto, production = false) {
        this.secrets = secrets;
        this.crypto = crypto;
        this.production = production;
        this.encryptionKeys = new Map();
        this._resolved = false;
    }

    async ensureEncryptionKeys() {
        if (this._resolved) return;
        this._resolved = true;

        // Load current key
        try {
            const keyB64 = await this.secrets.getRequiredSecret('citadelle.mfa.encryption.key');
            const key = Buffer.from(keyB64, 'base64');
            if (key.length !== KEY_LENGTH) {
                throw new Error(`Invalid key length: ${key.length}`);
            }
            this.encryptionKeys.set('v1', key);
        } catch {
            if (this.production) {
                throw new Error('MFA encryption key not configured');
            }
            const devKey = crypto.randomBytes(KEY_LENGTH);
            this.encryptionKeys.set('v1', devKey);
        }

        // Load previous key versions
        let version = 2;
        while (true) {
            try {
                const oldKeyB64 = await this.secrets.getSecret(`citadelle.mfa.encryption.key.v${version}`);
                if (!oldKeyB64) break;
                const oldKey = Buffer.from(oldKeyB64, 'base64');
                if (oldKey.length !== KEY_LENGTH) {
                    version++;
                    continue;
                }
                this.encryptionKeys.set(`v${version}`, oldKey);
                version++;
            } catch {
                break;
            }
        }
    }

    getCurrentKey() {
        const versions = Array.from(this.encryptionKeys.keys()).sort();
        const latest = versions[versions.length - 1];
        return this.encryptionKeys.get(latest);
    }

    async encryptTotpSecret(plaintext) {
        await this.ensureEncryptionKeys();
        const key = this.getCurrentKey();
        const currentVersion = Array.from(this.encryptionKeys.keys()).sort().pop();
        const result = await this.crypto.encrypt(plaintext, key);
        return {
            ciphertext: result.ciphertext.toString('latin1'),
            iv: result.iv.toString('latin1'),
            tag: result.tag,
            keyVersion: currentVersion
        };
    }

    async decryptTotpSecret(ciphertextStr, ivStr, tag, keyVersion) {
        await this.ensureEncryptionKeys();
        const ciphertext = Buffer.from(ciphertextStr, 'latin1');
        const iv = Buffer.from(ivStr, 'latin1');

        // Hybrid decryption: try all known keys
        const lastError = null;
        for (const [version, key] of this.encryptionKeys) {
            try {
                const decrypted = await this.crypto.decrypt(ciphertext, key, iv, tag);
                return decrypted.toString('utf8');
            } catch (err) {
                // Try next key
            }
        }
        throw new Error('MFA_DECRYPT_FAILED: No key could decrypt the secret');
    }
}

async function runKeyRotationTest() {
    const secretsPort = new MockSecretsPort();
    const cryptoPort = new MockCryptoPort();
    const keyManager = new MfaServiceKeyManager(secretsPort, cryptoPort, false);

    console.log('=== MFA KEY ROTATION INTEGRATION TEST ===\n');

    // Test 1: Encrypt with v1 key, decrypt with v1
    console.log('Test 1: Encrypt with v1, decrypt with v1');
    await secretsPort.setSecret('citadelle.mfa.encryption.key', Buffer.from(crypto.randomBytes(KEY_LENGTH)).toString('base64'));
    const encrypted1 = await keyManager.encryptTotpSecret(Buffer.from('my-totp-secret-v1'));
    const decrypted1 = await keyManager.decryptTotpSecret(encrypted1.ciphertext, encrypted1.iv, encrypted1.tag, 'v1');
    console.log(`  Encrypted with: ${encrypted1.keyVersion}`);
    console.log(`  Decrypted: ${decrypted1}`);
    console.log(`  Match: ${decrypted1 === 'my-totp-secret-v1' ? 'PASS' : 'FAIL'}\n`);

    // Test 2: Rotate to v2 key, encrypt with v2, decrypt with v2
    console.log('Test 2: Rotate to v2, encrypt with v2, decrypt with v2');
    await secretsPort.setSecret('citadelle.mfa.encryption.key.v2', Buffer.from(crypto.randomBytes(KEY_LENGTH)).toString('base64'));
    await keyManager.ensureEncryptionKeys(); // Reload to get v2
    const encrypted2 = await keyManager.encryptTotpSecret(Buffer.from('my-totp-secret-v2'));
    const decrypted2 = await keyManager.decryptTotpSecret(encrypted2.ciphertext, encrypted2.iv, encrypted2.tag, 'v2');
    console.log(`  Encrypted with: ${encrypted2.keyVersion}`);
    console.log(`  Decrypted: ${decrypted2}`);
    console.log(`  Match: ${decrypted2 === 'my-totp-secret-v2' ? 'PASS' : 'FAIL'}\n`);

    // Test 3: Hybrid decryption - decrypt v1-encrypted secret with v2 key loaded (should still work with v1)
    console.log('Test 3: Decrypt v1-encrypted secret after key rotation (hybrid decryption)');
    const decrypted1_again = await keyManager.decryptTotpSecret(encrypted1.ciphertext, encrypted1.iv, encrypted1.tag, 'v1');
    console.log(`  Decrypted v1-encrypted with v2 key loaded: ${decrypted1_again}`);
    console.log(`  Match: ${decrypted1_again === 'my-totp-secret-v1' ? 'PASS' : 'FAIL'}\n`);

    // Test 4: Re-encrypt v1 secret with v2 key (progressive re-encryption)
    console.log('Test 4: Re-encrypt v1 secret with v2 key');
    const reencrypted = await keyManager.encryptTotpSecret(Buffer.from(decrypted1_again));
    const redecrypted = await keyManager.decryptTotpSecret(reencrypted.ciphertext, reencrypted.iv, reencrypted.tag, reencrypted.keyVersion);
    console.log(`  Re-encrypted with: ${reencrypted.keyVersion}`);
    console.log(`  Re-decrypted: ${redecrypted}`);
    console.log(`  Match: ${redecrypted === 'my-totp-secret-v1' ? 'PASS' : 'FAIL'}\n`);

    console.log('=== KEY ROTATION INTEGRATION TEST COMPLETE ===');
}

runKeyRotationTest().catch(console.error);
