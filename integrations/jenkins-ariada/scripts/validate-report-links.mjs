import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const files = [
  resolve(root, 'test-report/result.html'),
  resolve(root, 'scan-evidence/result.html'),
];

const requiredPhrases = [
  'What is Jenkins?',
  'Why this is a separate Ariada channel',
  'Roles: who pays / what value they buy',
  'Implemented vs not implemented',
  'Competitors',
  'Domains',
  'Technical connectors',
  'Evidence',
  'Screenshot',
  'Blockers',
  'Distribution',
  'Monetization',
  'Sources',
];

for (const file of files) {
  const report = readFileSync(file, 'utf8');
  for (const phrase of requiredPhrases) {
    if (!report.includes(phrase)) {
      throw new Error(`missing report phrase in ${file}: ${phrase}`);
    }
  }
}

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const refs = [...html.matchAll(/\b(?:href|src)="([^"#][^"]*)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^https?:\/\//.test(ref)) continue;
    const target = resolve(dirname(file), ref);
    if (!existsSync(target)) {
      throw new Error(`broken local link in ${file}: ${ref}`);
    }
  }
}

const scanEvidence = readFileSync(resolve(root, 'scan-evidence/result.html'), 'utf8');
if (!/href="[^"]+\.png"/.test(scanEvidence)) {
  throw new Error('scan-evidence/result.html is missing a direct clickable PNG href');
}
if (!/<img\b[^>]+src="[^"]+\.png"/.test(scanEvidence)) {
  throw new Error('scan-evidence/result.html is missing an embedded PNG image');
}

const screenshot = resolve(root, 'test-report/screenshot.png');
if (existsSync(screenshot)) {
  const bytes = readFileSync(screenshot);
  const signature = bytes.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    throw new Error('screenshot is not a PNG');
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 640 || height < 400 || statSync(screenshot).size < 10_000) {
    throw new Error(`screenshot appears blank or too small: ${width}x${height}`);
  }
}

const scanScreenshot = resolve(root, 'scan-evidence/screenshots/screenshot.png');
if (existsSync(scanScreenshot)) {
  const bytes = readFileSync(scanScreenshot);
  const signature = bytes.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a' || statSync(scanScreenshot).size < 10_000) {
    throw new Error('scan-evidence screenshot appears missing or invalid');
  }
}

console.log('jenkins-ariada evidence links validated');
