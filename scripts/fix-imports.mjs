#!/usr/bin/env node
/**
 * Fix relative imports to add .js extensions for NodeNext module resolution.
 * Scans all .ts files (excluding tests, node_modules, dist, .mosaix, remotion)
 * and appends .js to relative imports that lack an extension.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, dirname, relative } from 'node:path';

const ROOT = process.cwd();
const EXCLUDED_DIRS = new Set([
  'node_modules', 'dist', '.mosaix', 'remotion', '.git', 'coverage',
  'apps/_template', '.d', '.project', '.agents', '.github', '.mosaix',
  'plugins', 'themes', 'public', 'data', 'docs', 'skills', 'config',
  'bootstrap', 'tests', 'packages/adapters', 'packages/ports',
]);

const EXCLUDED_FILES = new Set([
  '.slop.json', 'pnpm-lock.yaml', 'tsconfig.build.tsbuildinfo',
]);

// Regex to match relative import/export specifiers
// Matches: from './foo', from '../bar', from './baz' (but not from 'module', from '@scope/pkg')
const RELATIVE_IMPORT_RE = /((?:import|export)\s+(?:type\s+)?(?:(?:[\s\S]*?\s+from\s+)?|.*?\s+require\s*\(\s*))(['"])(\.{1,2}\/[^'"]+)(['"])/g;
// Also handle: export { foo } from './bar'
const RELATIVE_REEXPORT_RE = /((?:export\s+)(?:type\s+)?[\s\S]*?\s+from\s+)(['"])(\.{1,2}\/[^'"]+)(['"])/g;

function walk(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch { return files; }
  for (const entry of entries) {
    if (entry.startsWith('.') && entry !== '.git') continue;
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      const rel = relative(ROOT, full);
      const topSeg = rel.split(/[\\/]/)[0];
      if (EXCLUDED_DIRS.has(topSeg) || EXCLUDED_DIRS.has(rel)) continue;
      walk(full, files);
    } else if (st.isFile() && entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      const rel = relative(ROOT, full);
      if (EXCLUDED_FILES.has(entry)) continue;
      if (rel.includes('node_modules')) continue;
      files.push(full);
    }
  }
  return files;
}

function hasExtension(path) {
  const ext = extname(path);
  return ext.length > 0 && ext !== '.ts' && ext !== '.tsx';
}

function fixFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  const original = content;
  let count = 0;

  // Fix: import ... from './foo'  →  import ... from './foo.js'
  // Fix: export ... from './foo'  →  export ... from './foo.js'
  // Fix: import('./foo')  →  import('./foo.js')
  // Fix: require('./foo')  →  require('./foo.js')

  // Pattern: any from/export/import/require with a relative path that has no extension
  const regex = /((?:import|export|require|import\s*\()\s*(?:[\s\S]*?\s+from\s+)?[\s\S]*?)(['"])(\.{1,2}\/[\w\-\/_@.]+)(['"])/g;

  content = content.replace(regex, (match, prefix, openQ, spec, closeQ) => {
    // Skip if already has an extension (other than .ts/.tsx)
    if (hasExtension(spec)) return match;
    // Skip if it's a directory index reference like './' (handled by adding index.js)
    // Add .js extension
    count++;
    return `${prefix}${openQ}${spec}.js${closeQ}`;
  });

  if (count > 0) {
    writeFileSync(filePath, content);
    console.log(`  ✓ ${relative(ROOT, filePath)}: ${count} imports fixed`);
  }
  return count;
}

console.log('=== Fixing relative imports for NodeNext ===\n');
const files = walk(ROOT);
console.log(`Found ${files.length} .ts files to scan\n`);

let totalFixed = 0;
let filesModified = 0;
for (const f of files) {
  const n = fixFile(f);
  if (n > 0) { filesModified++; totalFixed += n; }
}

console.log(`\n=== Done: ${filesModified} files modified, ${totalFixed} imports fixed ===\n`);