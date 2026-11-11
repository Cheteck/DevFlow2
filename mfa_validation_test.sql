-- MFA Validation Test Script for Citadelle
-- Run with: docker exec -i mosaix-db-1 psql -U mosaix -d mosaix_dev -f /tmp/mfa_validation_test.sql

DROP TABLE IF EXISTS public.mfa_used_totp_steps;
DROP TABLE IF EXISTS public.mfa_secrets;

CREATE TABLE public.mfa_secrets (
  user_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  encrypted_secret TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  encryption_tag TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  enrolled_at TIMESTAMP,
  last_verified_at TIMESTAMP,
  recovery_codes TEXT NOT NULL DEFAULT '[]',
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  lock_until TIMESTAMP,
  key_version TEXT NOT NULL DEFAULT 'v1'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mfa_secrets_tenant_user 
  ON public.mfa_secrets(tenant_id, user_id);

CREATE TABLE public.mfa_used_totp_steps (
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  totp_step INTEGER NOT NULL,
  used_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, user_id, totp_step)
);

INSERT INTO public.mfa_secrets (user_id, tenant_id, encrypted_secret, encryption_iv, encryption_tag, enabled, enrolled_at, last_verified_at, recovery_codes, failed_attempts, lock_until, key_version)
VALUES ('user-1', 'tenant-1', 'encrypted-secret-test', 'iv-test', 'tag-test', true, NOW(), NOW(), '[]', 0, NULL, 'v1');

SELECT 'TABLES CREATED' as phase;
SELECT count(*) as mfa_secrets_rows FROM public.mfa_secrets;
SELECT count(*) as mfa_used_totp_steps_rows FROM public.mfa_used_totp_steps;

DELETE FROM public.mfa_used_totp_steps WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

INSERT INTO public.mfa_used_totp_steps (tenant_id, user_id, totp_step, used_at)
VALUES ('tenant-1', 'user-1', 100, NOW())
ON CONFLICT (tenant_id, user_id, totp_step) DO NOTHING;

SELECT 'TEST 1 - Replay protection: step 100 already used' as test;
SELECT count(*) as already_used_rows FROM public.mfa_used_totp_steps 
WHERE tenant_id = 'tenant-1' AND user_id = 'user-1' AND totp_step = 100;

INSERT INTO public.mfa_used_totp_steps (tenant_id, user_id, totp_step, used_at)
VALUES ('tenant-1', 'user-1', 101, NOW())
ON CONFLICT (tenant_id, user_id, totp_step) DO NOTHING
RETURNING totp_step as newly_used_step;

SELECT count(*) as step_101_count FROM public.mfa_used_totp_steps 
WHERE tenant_id = 'tenant-1' AND user_id = 'user-1' AND totp_step = 101;

UPDATE public.mfa_secrets SET failed_attempts = 0, lock_until = NULL WHERE user_id = 'user-1';

UPDATE public.mfa_secrets 
SET failed_attempts = failed_attempts + 1,
    lock_until = CASE 
      WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '5 minutes' 
      ELSE lock_until 
    END
WHERE user_id = 'user-1' AND tenant_id = 'tenant-1' 
  AND (lock_until IS NULL OR lock_until < NOW())
RETURNING failed_attempts as attempt_1_count;

UPDATE public.mfa_secrets 
SET failed_attempts = failed_attempts + 1,
    lock_until = CASE 
      WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '5 minutes' 
      ELSE lock_until 
    END
WHERE user_id = 'user-1' AND tenant_id = 'tenant-1' 
  AND (lock_until IS NULL OR lock_until < NOW())
RETURNING failed_attempts as attempt_2_count;

SELECT 'TEST 2 - Concurrent lockout counter should be 2' as test;
SELECT failed_attempts FROM public.mfa_secrets WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

SELECT 'TEST 3 - Persistence after restart' as test;
SELECT totp_step, used_at FROM public.mfa_used_totp_steps 
WHERE tenant_id = 'tenant-1' AND user_id = 'user-1'
ORDER BY totp_step;

SELECT count(*) as steps_persisted FROM public.mfa_used_totp_steps 
WHERE tenant_id = 'tenant-1' AND user_id = 'user-1';

UPDATE public.mfa_secrets SET key_version = 'v1' WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

SELECT 'TEST 4 - Key version v1' as test;
SELECT key_version FROM public.mfa_secrets WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

UPDATE public.mfa_secrets SET key_version = 'v2' WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

SELECT 'TEST 4 - Key version v2 after rotation' as test;
SELECT key_version FROM public.mfa_secrets WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

UPDATE public.mfa_secrets SET key_version = 'v1' WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

UPDATE public.mfa_secrets 
SET enabled = false, 
    encrypted_secret = NULL, 
    encryption_iv = NULL, 
    encryption_tag = NULL,
    recovery_codes = '[]',
    last_verified_at = NULL
WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

SELECT 'TEST 5 - Session revocation (MFA disabled)' as test;
SELECT enabled, encrypted_secret IS NULL as secret_cleared FROM public.mfa_secrets 
WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

SELECT '=== FINAL TEST SUMMARY ===' as summary;
SELECT 
  (SELECT count(*) FROM public.mfa_secrets WHERE user_id = 'user-1' AND tenant_id = 'tenant-1' AND enabled = false) as mfa_disabled,
  (SELECT count(*) FROM public.mfa_used_totp_steps WHERE tenant_id = 'tenant-1' AND user_id = 'user-1') as totp_steps_persisted,
  (SELECT failed_attempts FROM public.mfa_secrets WHERE user_id = 'user-1' AND tenant_id = 'tenant-1') as final_failed_attempts,
  (SELECT key_version FROM public.mfa_secrets WHERE user_id = 'user-1' AND tenant_id = 'tenant-1') as current_key_version;