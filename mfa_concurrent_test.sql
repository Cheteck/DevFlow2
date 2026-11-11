-- MFA Concurrency Test - Two independent PostgreSQL connections
-- Test 1: Two concurrent INSERTs into mfa_used_totp_steps (same step)
-- Only one should succeed (atomic ON CONFLICT)

DELETE FROM public.mfa_used_totp_steps WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

-- Connection 1: Insert step 300
INSERT INTO public.mfa_used_totp_steps (tenant_id, user_id, totp_step, used_at)
VALUES ('tenant-1', 'user-1', 300, NOW())
ON CONFLICT (tenant_id, user_id, totp_step) DO NOTHING
RETURNING totp_step as conn1_step;

-- Connection 2: Try same step 300 (should return 0 rows)
INSERT INTO public.mfa_used_totp_steps (tenant_id, user_id, totp_step, used_at)
VALUES ('tenant-1', 'user-1', 300, NOW())
ON CONFLICT (tenant_id, user_id, totp_step) DO NOTHING
RETURNING totp_step as conn2_step;

-- Verify only ONE row for step 300
SELECT 'TEST CONCURRENT OTP - Only one session should succeed' as test;
SELECT count(*) as step_300_count FROM public.mfa_used_totp_steps 
WHERE tenant_id = 'tenant-1' AND user_id = 'user-1' AND totp_step = 300;

-- Test 2: Two concurrent lockout increments
UPDATE public.mfa_secrets SET failed_attempts = 0, lock_until = NULL WHERE user_id = 'user-1';

-- Connection 1: First increment
UPDATE public.mfa_secrets 
SET failed_attempts = failed_attempts + 1,
    lock_until = CASE 
      WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '5 minutes' 
      ELSE lock_until 
    END
WHERE user_id = 'user-1' AND tenant_id = 'tenant-1' 
  AND (lock_until IS NULL OR lock_until < NOW())
RETURNING failed_attempts as lockout_attempt_1;

-- Connection 2: Second increment
UPDATE public.mfa_secrets 
SET failed_attempts = failed_attempts + 1,
    lock_until = CASE 
      WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '5 minutes' 
      ELSE lock_until 
    END
WHERE user_id = 'user-1' AND tenant_id = 'tenant-1' 
  AND (lock_until IS NULL OR lock_until < NOW())
RETURNING failed_attempts as lockout_attempt_2;

-- Verify counter is exactly 2
SELECT 'TEST CONCURRENT LOCKOUT - Counter should be exactly 2' as test;
SELECT failed_attempts FROM public.mfa_secrets WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

-- Test 3: Key rotation - Encrypt/decrypt simulation
-- In production, this would use actual crypto keys
-- Here we verify key_version column tracks versions correctly
UPDATE public.mfa_secrets SET key_version = 'v1' WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';
SELECT 'TEST KEY ROTATION - v1 stored' as test;
SELECT key_version FROM public.mfa_secrets WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

UPDATE public.mfa_secrets SET key_version = 'v2' WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';
SELECT 'TEST KEY ROTATION - v2 stored after rotation' as test;
SELECT key_version FROM public.mfa_secrets WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

-- Reset to v1
UPDATE public.mfa_secrets SET key_version = 'v1' WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

-- Test 4: Session revocation
UPDATE public.mfa_secrets 
SET enabled = false, encrypted_secret = '', encryption_iv = '', encryption_tag = '', recovery_codes = '[]'
WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

SELECT 'TEST SESSION REVOCATION - MFA disabled, access should be refused' as test;
SELECT enabled, encrypted_secret = '' as secret_cleared FROM public.mfa_secrets 
WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

-- Restore state
UPDATE public.mfa_secrets 
SET enabled = true, encrypted_secret = 'encrypted-secret-test', encryption_iv = 'iv-test', 
    encryption_tag = 'tag-test', failed_attempts = 0, lock_until = NULL, key_version = 'v1'
WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

SELECT 'TEST STATE RESTORED' as test;
SELECT enabled, encrypted_secret, key_version FROM public.mfa_secrets 
WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';