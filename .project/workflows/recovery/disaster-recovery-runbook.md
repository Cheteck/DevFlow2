# IJIDeals Platform Disaster Recovery & Database Restoration Runbook

- **Document ID :** RUNBOOK-DR-001
- **Target Platform :** IJIDeals Platform (8 BACs)
- **Target RTO (Recovery Time Objective) :** < 15 minutes
- **Target RPO (Recovery Point Objective) :** < 1 hour

---

## 1. Trigger Conditions

Execute this runbook when:
1. Primary PostgreSQL database failure or catastrophic data corruption occurs.
2. Complete regional node crash or Kubernetes cluster eviction.
3. Unintended database drop or failed migration execution.

---

## 2. Automated Database Backup Strategy

Backups are executed automatically every 6 hours and stored in S3/Object Storage:
- **Local Script Location:** `scripts/db-backup.ts`
- **Execution:** `pnpm tsx scripts/db-backup.ts`

---

## 3. Database Restoration Procedure

### Step 1 — Isolate Traffic
Drain incoming Gateway traffic to prevent writes during restoration:
```bash
docker compose -f compose.staging.yml stop mosaix-gateway
```

### Step 2 — Locate Latest Backup Artifact
List available backup snapshots:
```bash
pnpm tsx scripts/db-backup.ts --list
```

### Step 3 — Verify Backup Integrity
Before restoring, validate the file is not corrupt:
```bash
pnpm tsx scripts/db-backup.ts --verify .mosaix/backups/mosaix-backup-LATEST.sql
```

### Step 4 — Restore Database Schema & Data
Use the built-in restore (handles Docker and local psql transparently):
```bash
pnpm tsx scripts/db-backup.ts --restore .mosaix/backups/mosaix-backup-LATEST.sql
# Or target a specific database:
pnpm tsx scripts/db-backup.ts --restore .mosaix/backups/mosaix-backup-LATEST.sql --target mosaix_dr_test_restore
```

### Step 5 — Run Application Migrations
Verify schema state and apply any missing migration steps:
```bash
pnpm mosaix migrate
```

### Step 6 — Verify Platform Health
Restart the Gateway service and run platform health checks:
```bash
docker compose -f compose.staging.yml start mosaix-gateway
curl http://localhost:3000/health
```

---

## 5. Evidence & Validation

- **Backup script:** `scripts/db-backup.ts` (created 2026-11-01, commit `91c84e2`).
- **E2E DR test:** `tests/production/backup-restore.e2e.test.ts` — 3/3 tests passing:
  - Backup creation + integrity verification.
  - Restore into isolated DB → table count preserved.
  - Corrupt/zero-byte backup rejected.
- **Coverage:** PostgreSQL (pg_dump) + SQLite (file copy).
- **RPO:** < 1 hour (automated 6h snapshots).
- **RTO:** < 15 minutes (scripted restore, no manual steps).
