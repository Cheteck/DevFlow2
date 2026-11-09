/**
 * @apps/citadelle — Create mfa_secrets table for MFA state persistence
 *
 * Creates the public.mfa_secrets table to persist multi-factor authentication
 * state per user. This migration is applied via the shell migration registry
 * and is owned by the citadelle BAC.
 */
import { computeChecksum, type Migration } from "@mosaix/migrations";

export const migration: Migration = {
  id: "20261108130000_create_mfa_secrets",
  content: `
    CREATE TABLE IF NOT EXISTS public.mfa_secrets (
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

    CREATE UNIQUE INDEX IF NOT EXISTS idx_mfa_secrets_tenant_user ON public.mfa_secrets(tenant_id, user_id);

    CREATE TABLE IF NOT EXISTS public.mfa_used_totp_steps (
      tenant_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      totp_step INTEGER NOT NULL,
      used_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (tenant_id, user_id, totp_step)
    );
  `,
  checksum: computeChecksum(`
    CREATE TABLE IF NOT EXISTS public.mfa_secrets (
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

    CREATE UNIQUE INDEX IF NOT EXISTS idx_mfa_secrets_tenant_user ON public.mfa_secrets(tenant_id, user_id);

    CREATE TABLE IF NOT EXISTS public.mfa_used_totp_steps (
      tenant_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      totp_step INTEGER NOT NULL,
      used_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (tenant_id, user_id, totp_step)
    );
  `),
  resources: ["table:mfa_secrets", "table:mfa_used_totp_steps"],
};
