'use strict';

const { existsSync, readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { inflateSync } = require('node:zlib');

const root = resolve(__dirname, '..');
const requiredFiles = [
  'test-report/result.html',
  'scan-evidence/result.html',
  'scan-evidence/result.json',
  'scan-evidence/result-screenshot.png'
];

for (const relativePath of requiredFiles) {
  const path = join(root, relativePath);
  if (!existsSync(path)) throw new Error(`${relativePath} is missing`);
  if (readFileSync(path).length === 0) throw new Error(`${relativePath} is empty`);
}

const testReport = readFileSync(join(root, 'test-report/result.html'), 'utf8');
const evidenceReport = readFileSync(join(root, 'scan-evidence/result.html'), 'utf8');

for (const text of ['contrast', 'target-size', 'text-alternative']) {
  if (!testReport.includes(text) || !evidenceReport.includes(text)) {
    throw new Error(`evidence reports must include ${text}`);
  }
}

const screenshot = readFileSync(join(root, 'scan-evidence/result-screenshot.png'));
if (!isPng(screenshot)) throw new Error('screenshot is not a PNG');

const width = screenshot.readUInt32BE(16);
const height = screenshot.readUInt32BE(20);
if (width < 640 || height < 360) {
  throw new Error(`screenshot is too small: ${width}x${height}`);
}

if (!containsNonBlankPixels(screenshot)) {
  throw new Error('screenshot appears blank');
}

if (!evidenceReport.includes('href="./result-screenshot.png"')) {
  throw new Error('scan evidence report must link directly to the screenshot');
}

function isPng(buffer) {
  return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

function containsNonBlankPixels(buffer) {
  const idat = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IDAT') idat.push(data);
    offset += length + 12;
  }
  const inflated = inflateSync(Buffer.concat(idat));
  return inflated.includes(Buffer.from([17, 24, 39, 255])) && inflated.includes(Buffer.from([220, 38, 38, 255]));
}
