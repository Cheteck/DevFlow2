#!/usr/bin/env node
/**
 * Fix relative imports for NodeNext module resolution.
 * Only modifies import/export specifiers — never arbitrary strings.
 * Uses targeted patterns for each import form.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const EXCLUDED_DIRS = new Set([
  'node_modules', 'dist', '.mosaix', 'remotion', '.git', 'coverage',
  'apps/_template', '.d', '.project', '.agents', '.github',
  'plugins', 'themes', 'public', 'data', 'docs', 'skills',
  'bootstrap', 'tests',
]);

function isExcluded(path) {
  const segments = path.split(/[\\/]/);
  return segments.some((seg) => EXCLUDED_DIRS.has(seg));
}

function walk(dir, files = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return files; }
  for (const entry of entries) {
    if (entry.startsWith('.') && entry !== '.git') continue;
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      const rel = relative(ROOT, full);
      if (isExcluded(rel)) continue;
      walk(full, files);
    } else if (st.isFile() && entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      const rel = relative(ROOT, full);
      if (isExcluded(rel)) continue;
      files.push(full);
    }
  }
  return files;
}

function normalizeSpec(spec) {
  // Strip .ts, .tsx, .ts.js double extensions, then ensure .js
  if (spec.endsWith('.ts.js')) return spec.slice(0, -6) + '.js';
  if (spec.endsWith('.ts')) return spec.slice(0, -3) + '.js';
  if (spec.endsWith('.tsx')) return spec.slice(0, -4) + '.js';
  if (spec.endsWith('.js')) return spec; // already correct
  return spec + '.js';
}

function fixFile(filePath) {
  const original = readFileSync(filePath, 'utf8');
  let content = original;
  let count = 0;

  // Pattern 1: import/export ... from './path'
  // Matches: from "..." or from '...'
  content = content.replace(
    /(\bfrom\s+)(['"])(\.{1,2}\/[\w\-_\/@.]+)(['"])/g,
    (m, prefix, qOpen, spec, qClose) => {
      const fixed = normalizeSpec(spec);
      if (fixed !== spec) { count++; return `${prefix}${qOpen}${fixed}${qClose}`; }
      return m;
    }
  );

  // Pattern 2: import('./path') or require('./path')
  content = content.replace(
    /((?:import|require)\s*\(\s*)(['"])(\.{1,2}\/[\w\-_\/@.]+)(['"])/g,
    (m, prefix, qOpen, spec, qClose) => {
      const fixed = normalizeSpec(spec);
      if (fixed !== spec) { count++; return `${prefix}${qOpen}${fixed}${qClose}`; }
      return m;
    }
  );

  if (count > 0) {
    writeFileSync(filePath, content);
    return count;
  }
  return 0;
}

console.log('=== Fixing relative imports for NodeNext ===\n');
const files = walk(ROOT);
console.log(`Found ${files.length} .ts files to scan\n`);

let totalFixed = 0;
let filesModified = 0;
const changed = [];

for (const f of files) {
  const n = fixFile(f);
  if (n > 0) { filesModified++; totalFixed += n; changed.push({ file: relative(ROOT, f), count: n }); }
}

console.log(`Modified ${filesModified} files, ${totalFixed} imports fixed\n`);
for (const c of changed.slice(0, 30)) {
  console.log(`  ${c.file}: ${c.count}`);
}
if (changed.length > 30) console.log(`  ... and ${changed.length - 30} more`);