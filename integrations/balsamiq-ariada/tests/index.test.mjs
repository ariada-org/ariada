import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildAriadaCliArgs, manualChecklist, resolveBalsamiqTarget } from '../dist/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('resolves a Balsamiq HTML export folder to index.html', () => {
  const target = resolveBalsamiqTarget({ exportPath: 'fixtures/html-export' }, root);
  assert.equal(target.kind, 'html-export');
  assert.equal(target.target, resolve(root, 'fixtures/html-export/index.html'));
});

test('builds @ariada-org/cli scan arguments for published Cloud URLs', () => {
  assert.deepEqual(
    buildAriadaCliArgs({
      targetUrl: 'https://example.test/balsamiq/prototype',
      outputDir: 'ariada-output',
      severityThreshold: 'moderate',
    }),
    [
      'scan',
      'https://example.test/balsamiq/prototype',
      '--severity-threshold',
      'moderate',
      '--format',
      'json',
      '--output-dir',
      'ariada-output',
    ],
  );
});

test('rejects PNG-only exports and points to the manual checklist', () => {
  assert.throws(
    () => resolveBalsamiqTarget({ exportPath: 'fixtures/png-only' }, root),
    /PNG\/PDF-only Balsamiq wireframes/u,
  );
  assert.ok(manualChecklist().some((item) => item.includes('WCAG 2.5.8')));
});
