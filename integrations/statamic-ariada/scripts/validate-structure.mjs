#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const composer = JSON.parse(readFileSync(resolve(root, 'composer.json'), 'utf8'));
const provider = readFileSync(resolve(root, 'src/ServiceProvider.php'), 'utf8');

if (composer.type !== 'statamic-addon') throw new Error('Statamic composer type must be statamic-addon');
if (!provider.includes('renderedEntryUrl') || !provider.includes('scanRequest')) {
  throw new Error('Statamic addon must expose rendered URL and scan request helpers');
}

console.log('PASS statamic-ariada structure');
