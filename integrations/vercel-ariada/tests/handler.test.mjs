// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCheckPayload, buildScanRequest } from '../dist/src/handler.js';

const event = {
  type: 'deployment.ready',
  deployment: {
    id: 'dpl_123',
    url: 'preview.example.vercel.app',
  },
};

test('builds a hosted scan request from a deployment.ready event', () => {
  assert.deepEqual(buildScanRequest(event), {
    url: 'https://preview.example.vercel.app',
    failOnSeverity: 'serious',
    deploymentId: 'dpl_123',
    provider: 'vercel',
  });
});

test('creates a failed check payload when findings meet the threshold', () => {
  const payload = buildCheckPayload(event, {
    total: 1,
    critical: 0,
    serious: 1,
    moderate: 0,
    minor: 0,
  });

  assert.equal(payload.conclusion, 'failed');
  assert.equal(payload.blocking, true);
  assert.match(payload.output.summary, /1 findings/u);
});
