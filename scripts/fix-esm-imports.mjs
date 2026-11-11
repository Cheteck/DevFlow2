import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../packages/contracts/src');

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      fixImports(fullPath);
    }
  }
}

function fixImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Match: from "./foo" or from './foo' or import("./foo")
  // Regex looks for from/import followed by a relative path without extension
  const regex = /(from|import\s*\(?)\s*['"](\.\.?\/[^'"]+)(?<!\.js)['"]\s*([);])?/g;

  content = content.replace(regex, (match, p1, p2, p3) => {
    // Check if it's already a file or directory
    const targetPath = path.resolve(path.dirname(filePath), p2);
    
    let newPath = p2;
    if (fs.existsSync(targetPath + '.ts') || fs.existsSync(targetPath + '.tsx')) {
       newPath = p2 + '.js';
    } else if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
       // Check for index.ts in directory
       if (fs.existsSync(path.join(targetPath, 'index.ts')) || fs.existsSync(path.join(targetPath, 'index.tsx'))) {
         newPath = p2 + '/index.js';
       }
    }

    if (newPath !== p2) {
      changed = true;
      return `${p1} "${newPath}"${p3 || ''}`;
    }
    return match;
  });

  if (changed) {
    console.log(`Fixed: ${filePath}`);
    fs.writeFileSync(filePath, content);
  }
}

walk(srcDir);
