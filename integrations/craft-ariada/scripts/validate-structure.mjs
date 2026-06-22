#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const composer = JSON.parse(readFileSync(resolve(root, 'composer.json'), 'utf8'));
const plugin = readFileSync(resolve(root, 'src/Plugin.php'), 'utf8');

if (composer.type !== 'craft-plugin') throw new Error('Craft composer type must be craft-plugin');
if (!plugin.includes('renderedEntryUrl') || !plugin.includes('scanRequest')) {
  throw new Error('Craft plugin must expose rendered URL and scan request helpers');
}

console.log('PASS craft-ariada structure');
