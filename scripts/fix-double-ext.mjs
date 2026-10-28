#!/usr/bin/env node
/**
 * Fix double extensions like './foo.ts.js' → './foo.js'
 * and other import path issues introduced by the first fix script.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, dirname, relative } from 'node:path';

const ROOT = process.cwd();
const EXCLUDED = new Set(['node_modules', 'dist', '.mosaix', 'remotion', '.git', 'coverage', 'apps/_template']);

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
      const topSeg = rel.split(/[\\/]/)[0];
      if (EXCLUDED.has(topSeg) || EXCLUDED.has(rel)) continue;
      walk(full, files);
    } else if (st.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx'))) {
      files.push(full);
    }
  }
  return files;
}

function fixFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  const original = content;
  let count = 0;

  // Fix: './foo.ts.js' → './foo.js'  (double extension)
  content = content.replace(
    /(['"])(\.{1,2}\/[\w\-_\/@.]+?)\.ts\.js(['"])/g,
    (m, q1, spec, q2) => { count++; return `${q1}${spec}.js${q2}`; }
  );

  // Fix: './foo.ts' → './foo.js' (bare .ts extension in import)
  // But only for relative imports, not for type-only imports like './foo.ts'
  // Actually, with NodeNext, './foo.ts' should be './foo.js'
  content = content.replace(
    /(['"])(\.{1,2}\/[\w\-_\/@.]+?)\.ts(['"])/g,
    (m, q1, spec, q2) => { count++; return `${q1}${spec}.js${q2}`; }
  );

  if (count > 0 && content !== original) {
    writeFileSync(filePath, content);
    console.log(`  ✓ ${relative(ROOT, filePath)}: ${count} fixes`);
  }
  return count;
}

console.log('=== Fixing double extensions and bare .ts imports ===\n');
const files = walk(ROOT);
console.log(`Found ${files.length} files\n`);

let totalFixed = 0;
let filesModified = 0;
for (const f of files) {
  const n = fixFile(f);
  if (n > 0) { filesModified++; totalFixed += n; }
}

console.log(`\n=== Done: ${filesModified} files, ${totalFixed} fixes ===\n`);