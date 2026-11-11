function normalizeSpec(s) {
  if (s.endsWith('.ts.js')) return s.slice(0, -6) + '.js';
  if (s.endsWith('.ts')) return s.slice(0, -3) + '.js';
  if (s.endsWith('.tsx')) return s.slice(0, -4) + '.js';
  if (s.endsWith('.js')) return s;
  return s + '.js';
}
const FROM = /(\bfrom\s+)(['"])(\.{1,2}\/[\w\-_\/@.]+)(['"])/g;
const DYN = /((?:import|require)\s*\(\s*)(['"])(\.{1,2}\/[\w\-_\/@.]+)(['"])/g;

function fix(content) {
  let count = 0;
  content = content.replace(FROM, (m, p, q1, s, q2) => {
    const f = normalizeSpec(s);
    if (f !== s) count++;
    return p + q1 + f + q2;
  });
  content = content.replace(DYN, (m, p, q1, s, q2) => {
    const f = normalizeSpec(s);
    if (f !== s) count++;
    return p + q1 + f + q2;
  });
  return { content, count };
}

const cases = [
  ['import { X } from "./a/b";', 'from bare'],
  ["import type { Y } from '../c/d';", 'from type relative'],
  ['const m = import("./dynamic");', 'dynamic import'],
  ['const r = require("./req");', 'require'],
  ['import "./side-effect";', 'side effect'],
  ['runtime: { entrypoint: "./src/index.ts", isolation: "trusted" }', 'manifest (should NOT change)'],
  ['const url = new URL("./path", import.meta.url);', 'URL (should NOT change)'],
  ['export { foo } from "./reexport";', 'reexport'],
];

for (const [input, label] of cases) {
  const { content, count } = fix(input);
  console.log(`\n[${label}]`);
  console.log(`  in : ${input}`);
  console.log(`  out: ${content}`);
  console.log(`  changed: ${count > 0}`);
}
