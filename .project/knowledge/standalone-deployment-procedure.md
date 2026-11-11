# Standalone Deployment Procedure (Production)

## Purpose

Deploy MosaiX to production hosting with a **400 000 inode limit** by transferring only the minimal runtime bundle (`.mosaix/standalone/`) and installing production dependencies without hoisting.

## Context

The standalone bundle contains:
- Pre-compiled JavaScript (`.mosaix/standalone/build/`) — 673+ JS files
- Synthesized manifests (`.mosaix/standalone/manifests/`) — 8 JSON files
- Entry point (`server.js`)
- Minimal `package.json` with `workspace:*` dependencies

**Inode budget:**
- `.mosaix/standalone/` contents: ~700 files
- `node_modules` (production, no shamefully-hoist): ~50 000–100 000 files
- **Total: <150 000 inodes** (well under 400 000 cap)

## Build Procedure (Local or CI)

```bash
# 1. Clean previous build artifacts
pnpm mosaix clean

# 2. Build production bundle
pnpm mosaix build

# 3. Verify build output
pnpm mosaix inspect
```

Expected output:
- `.mosaix/standalone/build/` — 673 compiled JS files
- `.mosaix/standalone/manifests/` — 8 manifest JSON files
- `.mosaix/standalone/server.js` — entry point
- `.mosaix/standalone/package.json` — production dependencies

## Deployment Procedure

### Step 1: Transfer Bundle

Transfer **only** `.mosaix/standalone/` to the production server:

```bash
# Example using rsync (exclude node_modules from any previous deploy)
rsync -avz --delete .mosaix/standalone/ user@server:/path/to/mosaix/
```

### Step 2: Install Production Dependencies

On the production server:

```bash
cd /path/to/mosaix

# Install production dependencies only (no devDependencies)
npm install --production
```

**Important:** Do NOT use `--shamefully-hoist` or PNPM on the production server. The `workspace:*` dependencies in `package.json` must be resolved to actual versions or bundled copies.

### Step 3: Configure Environment

Create `.env` with production settings:

```bash
MOSAIX_ENV=production
NODE_ENV=production
MOSAIX_PORT=3000
MOSAIX_DATABASE_URL=postgresql://user:pass@host:5432/mosaix
MOSAIX_AUTH_JWT_SECRET=<32+ character secret>
MOSAIX_SESSION_SECRET=<32+ character secret>
MOSAIX_DEMO_USERS=false
ALLOW_IN_MEMORY_IN_PRODUCTION=false
```

**Critical:**
- `NODE_ENV=production` activates `InMemoryGuard` production checks
- `MOSAIX_DEMO_USERS=false` disables demo mode features
- `ALLOW_IN_MEMORY_IN_PRODUCTION=false` (default) blocks in-memory fallbacks

### Step 4: Start Server

```bash
# Production start
node server.js
```

Or with a process manager (PM2 recommended):

```bash
pm2 start server.js --name mosaix-production
pm2 save
pm2 startup
```

## Verification Checklist

After deployment:

```bash
# 1. Check server is responding
curl http://localhost:3000/health

# 2. Verify no in-memory fallback warnings in logs
# Look for: [MOSAIX DEV SERVER SIGNAL] ⚠️ In-memory fallback

# 3. Confirm environment mode
curl http://localhost:3000/api/system/info
# Should show: environment: "production"

# 4. Verify inode usage
find /path/to/mosaix -type f | wc -l
# Should be < 400 000
```

## Known Issues

### Issue 1: `workspace:*` Dependencies

The generated `package.json` contains:
```json
{
  "dependencies": {
    "@mosaix/core": "workspace:*",
    "@mosaix/contracts": "workspace:*"
  }
}
```

**Problem:** `npm install --production` cannot resolve `workspace:*` references outside a PNPM workspace context.

**Solutions:**

**Option A (Recommended):** Bundle compiled dependencies into `.mosaix/standalone/build/` and update imports in `server.js` to use relative paths.

**Option B:** Replace `workspace:*` with actual version numbers or `file:` references before deployment:
```json
{
  "dependencies": {
    "@mosaix/core": "file:./packages/core",
    "@mosaix/contracts": "file:./packages/contracts"
  }
}
```

**Option C:** Copy the entire monorepo's `node_modules` (defeats inode optimization — not recommended).

### Issue 2: Manifest Synthesis Shows Empty Capabilities

The `mosaic inspect` output shows 36 packages with empty `capabilities`, `events`, `permissions` arrays. This is expected — manifest synthesis is partial and does not yet extract capability/event/permission declarations from package code.

## Rollback Procedure

```bash
# 1. Stop current process
pm2 stop mosaix-production

# 2. Restore previous bundle
rsync -avz --delete backup-server:/path/to/backup/.mosaix/standalone/ /path/to/mosaix/

# 3. Restart
pm2 start mosaix-production
```

## Security Notes

1. **Never commit `.env`** — use secrets management (Vault, AWS Secrets Manager, etc.)
2. **Never enable `ALLOW_IN_MEMORY_IN_PRODUCTION=true`** in production — this bypasses critical safety guards
3. **JWT secrets must be ≥32 characters** — shorter secrets are rejected in production
4. **Database credentials** must use least-privilege database users

## Related Documentation

- `.project/architecture/mosaix-build-runtime-folder-spec.md` — `.mosaix/` folder architecture
- `.project/architecture/in-memory-policy.md` — in-memory fallback policy
- `.project/reports/session-2026-10-30-build-standalone.md` — build/standalone session report
