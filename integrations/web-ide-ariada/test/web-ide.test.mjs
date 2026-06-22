import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildWebIdeScanArgs, formatTerminalSummary } from '../dist/run.js';

const fixture = JSON.parse(await readFile(new URL('../fixtures/scan-result.json', import.meta.url), 'utf8'));

test('builds hosted web IDE scan args', () => {
  assert.deepEqual(buildWebIdeScanArgs('https://preview.example.test'), [
    'scan',
    'https://preview.example.test',
    '--format',
    'json'
  ]);
});

test('formats CLI JSON for terminal output', () => {
  assert.match(formatTerminalSummary(fixture), /Violations: 1/u);
});
