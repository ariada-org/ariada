#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const failures = [];
if (manifest.name !== '@ariada-org/zeplin-ariada') failures.push('unexpected package name');
if (manifest.type !== 'module') failures.push('package must be ESM');
if (manifest.main !== 'dist/src/index.js') failures.push('main must point at dist/src/index.js');
if (manifest.zeplin?.displayName !== 'Ariada Accessibility Evidence') failures.push('missing zeplin.displayName');
const platforms = manifest.zeplin?.platforms ?? [];
if (!['web', 'ios', 'android', 'osx'].every((platform) => platforms.includes(platform))) failures.push('missing required Zeplin platforms');
if (manifest.dependencies?.['@ariada-org/cli'] !== 'file:../../packages/ariada-cli') failures.push('must depend on shared @ariada-org/cli');
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Zeplin extension package metadata is valid.');
