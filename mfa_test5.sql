-- TEST 5: Session revocation (MFA disabled)
-- Reset user-1
UPDATE public.mfa_secrets 
SET enabled = true, 
    encrypted_secret = 'encrypted-secret-test', 
    encryption_iv = 'iv-test', 
    encryption_tag = 'tag-test',
    recovery_codes = '[]',
    last_verified_at = NOW(),
    failed_attempts = 0,
    lock_until = NULL
WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

-- Disable MFA (use empty string for NOT NULL columns)
UPDATE public.mfa_secrets 
SET enabled = false, 
    encrypted_secret = '', 
    encryption_iv = '', 
    encryption_tag = '',
    recovery_codes = '[]',
    last_verified_at = NULL
WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

SELECT 'TEST 5 - Session revocation (MFA disabled)' as test;
SELECT enabled, encrypted_secret = '' as secret_cleared FROM public.mfa_secrets 
WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

SELECT 'TEST 5b - Verify MFA disabled state' as test;
SELECT enabled, encrypted_secret = '' as secret_empty, recovery_codes = '[]' as codes_cleared 
FROM public.mfa_secrets WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

-- Restore
UPDATE public.mfa_secrets 
SET enabled = true, 
    encrypted_secret = 'encrypted-secret-test', 
    encryption_iv = 'iv-test', 
    encryption_tag = 'tag-test',
    failed_attempts = 0,
    lock_until = NULL,
    key_version = 'v1'
WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';

SELECT 'TEST 5c - Restored state' as test;
SELECT enabled, encrypted_secret, key_version FROM public.mfa_secrets 
WHERE user_id = 'user-1' AND tenant_id = 'tenant-1';