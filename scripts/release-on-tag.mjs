#!/usr/bin/env node
/**
 * release-on-tag.mjs — Script local pour publier sur Verdaccio lors d'un tag/release
 *
 * Usage:
 *   node scripts/release-on-tag.mjs [options]
 *
 * Options:
 *   --tag=<tag>           Tag Git à publier (défaut: dernier tag)
 *   --registry=<url>      Registre Verdaccio (défaut: http://localhost:4873/)
 *   --scope=<scopes>      Scopes à publier (défaut: @mosaix,@mosaix-plugin,@ijideals,@ijideals-projects,@apps)
 *   --workspace=<dir>     Workspace racine (défaut: D:\Téléchargements\devflow)
 *   --npmrc=<file>        Fichier .npmrc avec token (défaut: L:\Dev-Setup\PackMan-Infra\registry\secrets\npmrc-admin)
 *   --start-registry      Démarrer Verdaccio si pas en cours (défaut: true)
 *   --dry-run             Build + validation seulement, pas de publication
 *   --skip-existing       Ne pas échouer si version déjà publiée
 */

import { spawnSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const INFRA_ROOT = 'L:\\Dev-Setup\\PackMan-Infra';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name) => argv.includes(`--${name}`);

const TAG = arg('tag', '');
const REGISTRY = arg('registry', 'http://localhost:4873/');
const SCOPES = arg('scope', '@mosaix,@mosaix-plugin,@ijideals,@ijideals-projects,@apps').split(',').map(s => s.trim()).filter(Boolean);
const WORKSPACE = arg('workspace', 'D:\\Téléchargements\\devflow');
const NPMRC = arg('npmrc', path.join(INFRA_ROOT, 'registry', 'secrets', 'npmrc-admin'));
const START_REGISTRY = flag('start-registry') || !argv.includes('--no-start-registry');
const DRY_RUN = flag('dry-run');
const SKIP_EXISTING = flag('skip-existing');

const log = (...a) => console.log('[release-on-tag]', ...a);
const ok = (m) => console.log('  ✅', m);
const warn = (m) => console.log('  ⚠️ ', m);
const bad = (m) => console.error('  ❌', m);

// ---------------------------------------------------------------- helpers
function runCmd(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', shell: true, ...opts });
  return { code: res.status ?? 0, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

async function waitForRegistry(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/-/ping`);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

async function ensureRegistryRunning() {
  log('🔍 Checking Verdaccio registry...');
  const running = await waitForRegistry(REGISTRY, 5000);
  if (running) {
    ok(`Registry already running at ${REGISTRY}`);
    return;
  }
  if (!START_REGISTRY) {
    throw new Error(`Registry not running at ${REGISTRY} and --start-registry not enabled`);
  }
  log('🚀 Starting Verdaccio...');
  const startScript = path.join(INFRA_ROOT, 'scripts', 'start-verdaccio.ps1');
  const res = runCmd('powershell', ['-ExecutionPolicy', 'Bypass', '-File', startScript]);
  if (res.code !== 0) {
    throw new Error(`Failed to start Verdaccio: ${res.stderr}`);
  }
  const ready = await waitForRegistry(REGISTRY, 60000);
  if (!ready) throw new Error('Verdaccio failed to start within 60s');
  ok('Verdaccio started successfully');
}

function getLatestTag() {
  const res = runCmd('git', ['describe', '--tags', '--abbrev=0'], { cwd: WORKSPACE });
  if (res.code !== 0 || !res.stdout.trim()) {
    throw new Error('No tags found in repository');
  }
  return res.stdout.trim();
}

function checkoutTag(tag) {
  log(`📥 Checking out tag: ${tag}`);
  const res = runCmd('git', ['checkout', tag], { cwd: WORKSPACE });
  if (res.code !== 0) {
    throw new Error(`Failed to checkout tag ${tag}: ${res.stderr}`);
  }
  // Update submodules
  const subRes = runCmd('git', ['submodule', 'update', '--init', '--recursive'], { cwd: WORKSPACE });
  if (subRes.code !== 0) {
    warn(`Submodule update had issues: ${subRes.stderr}`);
  }
  ok(`Checked out ${tag}`);
}

// ---------------------------------------------------------------- main
async function main() {
  try {
    log('=== Release Publication to Verdaccio ===');
    log(`Registry: ${REGISTRY}`);
    log(`Scopes: ${SCOPES.join(', ')}`);
    log(`Workspace: ${WORKSPACE}`);
    log(`Dry run: ${DRY_RUN}`);
    log('');

    // 1. Determine tag
    const tag = TAG || getLatestTag();
    log(`🏷️  Target tag: ${tag}`);

    // 2. Checkout tag
    checkoutTag(tag);

    // 3. Ensure registry
    await ensureRegistryRunning();

    // 4. Install & build
    log('📦 Installing dependencies...');
    let res = runCmd('pnpm', ['install', '--frozen-lockfile'], { cwd: WORKSPACE });
    if (res.code !== 0) throw new Error(`pnpm install failed: ${res.stderr}`);
    ok('Dependencies installed');

    log('🔨 Building workspace...');
    res = runCmd('pnpm', ['build'], { cwd: WORKSPACE });
    if (res.code !== 0) throw new Error(`pnpm build failed: ${res.stderr}`);
    ok('Build completed');

    // 5. Prepare publish scripts
    const scriptsDir = path.join(WORKSPACE, '.release-scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });
    const scriptFiles = ['publish-mosaix.mjs', 'staging.mjs', 'validation.mjs', 'validate-staging.mjs'];
    for (const f of scriptFiles) {
      fs.copyFileSync(path.join(INFRA_ROOT, 'scripts', 'release', f), path.join(scriptsDir, f));
    }
    ok('Publish scripts prepared');

    // 6. Run publish
    log('📤 Publishing to Verdaccio...');
    const publishArgs = [
      path.join(scriptsDir, 'publish-mosaix.mjs'),
      `--registry=${REGISTRY}`,
      `--workspace=${WORKSPACE}`,
      `--npmrc=${NPMRC}`,
      `--scope=${SCOPES.join(',')}`,
      SKIP_EXISTING ? '--skip-existing' : '',
      DRY_RUN ? '--dry-run' : '',
    ].filter(Boolean);

    const publishRes = runCmd('node', publishArgs, { cwd: WORKSPACE, stdio: 'inherit' });
    if (publishRes.code !== 0) {
      throw new Error('Publication failed (see logs above)');
    }
    ok('Publication completed successfully!');

    if (DRY_RUN) {
      log('');
      log('🔍 DRY RUN: No packages were actually published.');
      log('   Re-run without --dry-run to publish for real.');
    }

  } catch (err) {
    bad(err.message);
    process.exitCode = 1;
  }
}

main();