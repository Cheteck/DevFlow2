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
ls -la .mosaix/backups/
```

### Step 3 — Restore Database Schema & Data
For PostgreSQL:
```bash
psql $MOSAIX_DATABASE_URL < .mosaix/backups/mosaix-backup-LATEST.sql
```

### Step 4 — Run Application Migrations
Verify schema state and apply any missing migration steps:
```bash
pnpm mosaix migrate
```

### Step 5 — Verify Platform Health
Restart the Gateway service and run platform health checks:
```bash
docker compose -f compose.staging.yml start mosaix-gateway
curl http://localhost:3000/health
```
