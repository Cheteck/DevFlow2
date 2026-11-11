/**
 * MFA Key Rotation Test - Real encryption/decryption with two keys
 * Tests that secrets encrypted with key v1 can be decrypted with v1,
 * and secrets encrypted with key v2 can be decrypted with v2 (hybrid decryption)
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;

// Generate two test keys (v1 and v2)
const keyV1 = crypto.randomBytes(KEY_LENGTH);
const keyV2 = crypto.randomBytes(KEY_LENGTH);

console.log('=== MFA KEY ROTATION TEST ===\n');

// Test 1: Encrypt with v1, decrypt with v1
console.log('Test 1: Encrypt with v1, decrypt with v1');
const iv1 = crypto.randomBytes(16);
const plaintext1 = 'my-totp-secret-base32';

const cipher1 = crypto.createCipheriv(ALGORITHM, keyV1, iv1);
let encrypted1 = cipher1.update(plaintext1, 'utf8', 'latin1');
encrypted1 += cipher1.final('latin1');
const tag1 = cipher1.getAuthTag();

console.log(`  Encrypted with v1: ${encrypted1.substring(0, 20)}...`);

// Decrypt with v1
const decipher1 = crypto.createDecipheriv(ALGORITHM, keyV1, iv1);
decipher1.setAuthTag(tag1);
let decrypted1 = decipher1.update(encrypted1, 'latin1', 'utf8');
decrypted1 += decipher1.final('utf8');

console.log(`  Decrypted with v1: ${decrypted1}`);
console.log(`  Match: ${decrypted1 === plaintext1 ? 'PASS' : 'FAIL'}\n`);

// Test 2: Encrypt with v2, decrypt with v2
console.log('Test 2: Encrypt with v2, decrypt with v2');
const iv2 = crypto.randomBytes(16);
const plaintext2 = 'my-totp-secret-base32-v2';

const cipher2 = crypto.createCipheriv(ALGORITHM, keyV2, iv2);
let encrypted2 = cipher2.update(plaintext2, 'utf8', 'latin1');
encrypted2 += cipher2.final('latin1');
const tag2 = cipher2.getAuthTag();

console.log(`  Encrypted with v2: ${encrypted2.substring(0, 20)}...`);

// Decrypt with v2
const decipher2 = crypto.createDecipheriv(ALGORITHM, keyV2, iv2);
decipher2.setAuthTag(tag2);
let decrypted2 = decipher2.update(encrypted2, 'latin1', 'utf8');
decrypted2 += decipher2.final('utf8');

console.log(`  Decrypted with v2: ${decrypted2}`);
console.log(`  Match: ${decrypted2 === plaintext2 ? 'PASS' : 'FAIL'}\n`);

// Test 3: Hybrid decryption - Try v1 key on v2-encrypted data (should fail)
console.log('Test 3: Decrypt v2-encrypted data with v1 key (should fail)');
try {
    const decipher3 = crypto.createDecipheriv(ALGORITHM, keyV1, iv2);
    decipher3.setAuthTag(tag2);
    let decrypted3 = decipher3.update(encrypted2, 'latin1', 'utf8');
    decrypted3 += decipher3.final('utf8');
    console.log(`  Decrypted with v1: ${decrypted3}`);
    console.log(`  Result: UNEXPECTED SUCCESS (should have failed)`);
} catch (e) {
    console.log(`  Correctly rejected with v1 key: ${e.message.substring(0, 50)}...`);
    console.log(`  Result: PASS (v1 cannot decrypt v2-encrypted data)`);
}

console.log('\n=== ALL KEY ROTATION TESTS COMPLETE ===');
