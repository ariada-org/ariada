import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['test-report/result.html', 'scan-evidence/result.html', 'scan-evidence/screenshot.png'];
const requiredPhrases = [
  'What is Magento / Adobe Commerce?',
  'Why this is a separate Ariada channel',
  'Roles: who pays / what value they buy',
  'Implemented vs not implemented',
  'competitors',
  'domains',
  'technical connectors',
  'evidence',
  'screenshot',
  'blockers',
  'distribution',
  'monetization',
  'sources',
  'HOST_BLOCKED'
];

for (const file of files) {
  await access(path.join(root, file));
}

const admin = await readFile(path.join(root, 'test-report/result.html'), 'utf8');
const scan = await readFile(path.join(root, 'scan-evidence/result.html'), 'utf8');
const screenshot = await readFile(path.join(root, 'scan-evidence/screenshot.png'));

if (!admin.includes('../scan-evidence/result.html')) throw new Error('admin report link missing');
if (!scan.includes('../test-report/result.html')) throw new Error('scan evidence link missing');
for (const phrase of requiredPhrases) {
  if (!scan.includes(phrase)) throw new Error(`required phrase missing: ${phrase}`);
}
if (!scan.includes('<img src="./screenshot.png"')) throw new Error('embedded screenshot image missing');
if (!scan.includes('href="./screenshot.png"')) throw new Error('direct screenshot link missing');
if (screenshot.length < 1024) throw new Error('screenshot too small');
if (screenshot.subarray(1, 4).toString('ascii') !== 'PNG') throw new Error('screenshot is not PNG');

console.log('evidence validation pass');
