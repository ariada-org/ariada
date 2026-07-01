import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlFiles = [
  resolve(packageRoot, 'scan-evidence/result.html'),
  resolve(packageRoot, 'test-report/result.html'),
];

const missing = [];

for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, 'utf8');
  const linkPattern = /\b(?:href|src)="([^"]+)"/g;
  let match = linkPattern.exec(html);

  while (match !== null) {
    const target = match[1];
    if (!target.startsWith('http') && !target.startsWith('#') && !target.startsWith('mailto:')) {
      const absolute = resolve(dirname(htmlFile), target);
      if (!existsSync(absolute)) {
        missing.push(`${htmlFile} -> ${target}`);
      }
    }

    match = linkPattern.exec(html);
  }
}

if (missing.length > 0) {
  throw new Error(`Missing evidence links:\n${missing.join('\n')}`);
}

console.log(`Validated ${htmlFiles.length} HTML evidence files; all local links resolve.`);
