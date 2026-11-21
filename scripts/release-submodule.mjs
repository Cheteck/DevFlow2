#!/usr/bin/env node
/**
 * release-submodule.mjs — Publie UN SEUL submodule sur Verdaccio
 *
 * Usage:
 *   node scripts/release-submodule.mjs <submodule-path> [options]
 *
 * Exemples:
 *   node scripts/release-submodule.mjs apps/developer-portal
 *   node scripts/release-submodule.mjs packages/adapters/event-store-database --tag=v0.2.0
 *   node scripts/release-submodule.mjs apps/developer-portal --dry-run
 *   node scripts/release-submodule.mjs packages/adapters/event-store-database --registry=http://localhost:4873/ --skip-existing
 *
 * Options:
 *   --tag=<tag>           Tag Git à créer/pousser (défaut: version du package.json)
 *   --registry=<url>      Registre Verdaccio (défaut: http://localhost:4873/)
 *   --workspace=<dir>     Racine du monorepo (défaut: D:\Téléchargements\devflow)
 *   --npmrc=<file>        Fichier .npmrc avec token
 *   --dry-run             Build + validation seulement
 *   --skip-existing       Ne pas échouer si version déjà publiée
 *   --push-tag            Pousser le tag vers origin (défaut: true)
 *   --no-push-tag         Ne pas pousser le tag
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const INFRA_ROOT = 'L:\\Dev-Setup\\PackMan-Infra';

const argv = process.argv.slice(2);
const SUBMODULE_REL = argv[0]?.replace(/\\/g, '/');

if (!SUBMODULE_REL) {
  console.error('❌ Usage: node scripts/release-submodule.mjs <submodule-path> [options]');
  console.error('   Ex: node scripts/release-submodule.mjs apps/developer-portal');
  process.exit(1);
}

const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name) => argv.includes(`--${name}`);

const TAG = arg('tag', '');
const REGISTRY = arg('registry', 'http://localhost:4873/');
const WORKSPACE = arg('workspace', 'D:\\Téléchargements\\devflow');
const NPMRC = arg('npmrc', path.join(INFRA_ROOT, 'registry', 'secrets', 'npmrc-admin'));
const DRY_RUN = flag('dry-run');
const SKIP_EXISTING = flag('skip-existing');
const PUSH_TAG = !flag('no-push-tag');

const SUBMODULE_ABS = path.join(WORKSPACE, SUBMODULE_REL);

const log = (...a) => console.log('[release-submodule]', ...a);
const ok = (m) => console.log('  ✅', m);
const warn = (m) => console.log('  ⚠️ ', m);
const bad = (m) => console.error('  ❌', m);

function runCmd(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', shell: true, ...opts });
  return { code: res.status ?? 0, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

async function waitForRegistry(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/-/ping`);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function ensureRegistryRunning() {
  log(`🔍 Checking Verdaccio at ${REGISTRY}...`);
  const running = await waitForRegistry(REGISTRY, 5000);
  if (running) {
    ok('Registry already running');
    return;
  }
  log('🚀 Starting Verdaccio...');
  const res = runCmd('powershell', ['-ExecutionPolicy', 'Bypass', '-File', path.join(INFRA_ROOT, 'scripts', 'start-verdaccio.ps1')]);
  if (res.code !== 0) throw new Error(`Failed to start Verdaccio: ${res.stderr}`);
  const ready = await waitForRegistry(REGISTRY, 60000);
  if (!ready) throw new Error('Verdaccio failed to start');
  ok('Verdaccio started');
}

// ---------------------------------------------------------------- main
async function main() {
  try {
    log(`=== Submodule Release: ${SUBMODULE_REL} ===`);
    log(`Registry: ${REGISTRY}`);
    log(`Workspace: ${WORKSPACE}`);
    log(`Dry run: ${DRY_RUN}`);
    log('');

    // 1. Validate submodule exists
    if (!fs.existsSync(SUBMODULE_ABS)) {
      throw new Error(`Submodule not found at ${SUBMODULE_ABS}\nRun: git submodule update --init ${SUBMODULE_REL}`);
    }

    const pkgJsonPath = path.join(SUBMODULE_ABS, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      throw new Error(`No package.json in ${SUBMODULE_ABS}`);
    }

    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const PKG_NAME = pkg.name;
    const PKG_VERSION = pkg.version;

    if (!PKG_NAME || !PKG_VERSION) {
      throw new Error('package.json must have "name" and "version"');
    }
    if (pkg.private === true) {
      throw new Error(`Package ${PKG_NAME} is private — cannot publish`);
    }

    log(`📦 Package: ${PKG_NAME}@${PKG_VERSION}`);
    log(`📁 Path: ${SUBMODULE_REL}`);
    log('');

    // 2. Determine tag
    const tag = TAG || `v${PKG_VERSION}`;
    log(`🏷️  Tag: ${tag}`);

    // 3. Ensure registry
    await ensureRegistryRunning();

    // 4. Build the submodule (in its own directory)
    log('🔨 Building submodule...');
    let res = runCmd('pnpm', ['install', '--frozen-lockfile'], { cwd: SUBMODULE_ABS });
    if (res.code !== 0) throw new Error(`pnpm install failed: ${res.stderr}`);
    ok('Dependencies installed');

    res = runCmd('pnpm', ['build'], { cwd: SUBMODULE_ABS });
    if (res.code !== 0) throw new Error(`pnpm build failed: ${res.stderr}`);
    ok('Build completed');

    // 5. Create tag in submodule repo
    log(`📝 Creating tag ${tag} in submodule...`);
    res = runCmd('git', ['tag', '-a', tag, '-m', `Release ${tag}`], { cwd: SUBMODULE_ABS });
    if (res.code !== 0 && !/already exists/i.test(res.stderr)) {
      throw new Error(`git tag failed: ${res.stderr}`);
    }
    ok(`Tag ${tag} created`);

    if (PUSH_TAG) {
      log('📤 Pushing tag to origin...');
      res = runCmd('git', ['push', 'origin', tag], { cwd: SUBMODULE_ABS });
      if (res.code !== 0) {
        warn(`Push tag failed (maybe already exists): ${res.stderr}`);
      } else {
        ok('Tag pushed');
      }
    }

    // 6. Prepare publish scripts
    const scriptsDir = path.join(SUBMODULE_ABS, '.release-scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });
    const scriptFiles = ['publish-mosaix.mjs', 'staging.mjs', 'validation.mjs', 'validate-staging.mjs'];
    for (const f of scriptFiles) {
      const src = path.join(INFRA_ROOT, 'scripts', 'release', f);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(scriptsDir, f));
      }
    }
    ok('Publish scripts prepared');

    // 7. Run publish for THIS package only (--only filter)
    log(`📤 Publishing ${PKG_NAME}@${PKG_VERSION} to Verdaccio...`);
    const publishArgs = [
      path.join(scriptsDir, 'publish-mosaix.mjs'),
      `--registry=${REGISTRY}`,
      `--workspace=${WORKSPACE}`,
      `--npmrc=${NPMRC}`,
      `--only=${PKG_NAME}`,
      SKIP_EXISTING ? '--skip-existing' : '',
      DRY_RUN ? '--dry-run' : '',
    ].filter(Boolean);

    const publishRes = runCmd('node', publishArgs, { cwd: WORKSPACE, stdio: 'inherit' });
    if (publishRes.code !== 0) {
      throw new Error('Publication failed (see logs above)');
    }
    ok(`Publication completed for ${PKG_NAME}@${PKG_VERSION}!`);

    if (DRY_RUN) {
      log('');
      log('🔍 DRY RUN: Package was NOT actually published.');
    }

    // 8. Summary
    log('');
    log('=== SUMMARY ===');
    log(`Package: ${PKG_NAME}@${PKG_VERSION}`);
    log(`Submodule: ${SUBMODULE_REL}`);
    log(`Tag: ${tag} ${PUSH_TAG ? '(pushed)' : '(local only)'}`);
    log(`Registry: ${REGISTRY}`);
    log(`Status: ${DRY_RUN ? 'DRY RUN' : 'PUBLISHED'}`);

  } catch (err) {
    bad(err.message);
    process.exitCode = 1;
  }
}

main();