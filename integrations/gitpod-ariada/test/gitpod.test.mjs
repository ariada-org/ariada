import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGitpodScanArgs } from '../scripts/run-ariada.mjs';

test('builds Ariada CLI args from Gitpod workspace URL', () => {
  assert.deepEqual(buildGitpodScanArgs('https://preview.example.test'), [
    'scan',
    'https://preview.example.test',
    '--format',
    'json'
  ]);
});

test('falls back to localhost preview when no workspace URL is supplied', () => {
  assert.deepEqual(buildGitpodScanArgs(''), ['scan', 'http://localhost:3000', '--format', 'json']);
});
