// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { runVercelCheckIntegration, WebhookAuthError } from '../dist/src/integration.js';

const secret = 'webhook-secret';
const rawBody = JSON.stringify({
  type: 'deployment.ready',
  deployment: { id: 'dpl_123', url: 'preview.example.vercel.app' },
});

function sign(payload) {
  return createHmac('sha1', secret).update(payload).digest('hex');
}

function fakeFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.body,
      text: async () => JSON.stringify(next.body),
    };
  };
  impl.calls = calls;
  return impl;
}

test('runs the full flow: verify -> scan -> create check -> update check', async () => {
  const fetchImpl = fakeFetch([
    { status: 200, body: { id: 'chk_abc' } },
    { status: 200, body: { id: 'chk_abc' } },
  ]);
  let scanRequestSeen;
  const runHostedScan = async (request) => {
    scanRequestSeen = request;
    return { total: 0, critical: 0, serious: 0, moderate: 0, minor: 0 };
  };

  const result = await runVercelCheckIntegration({
    rawBody,
    signatureHeader: sign(rawBody),
    webhookSecret: secret,
    vercelToken: 'token-xyz',
    runHostedScan,
    fetchImpl,
  });

  assert.equal(scanRequestSeen.url, 'https://preview.example.vercel.app');
  assert.equal(result.checkId, 'chk_abc');
  assert.equal(result.payload.conclusion, 'passed');
  assert.equal(fetchImpl.calls.length, 2);
  assert.match(fetchImpl.calls[0].url, /\/checks$/u);
  assert.match(fetchImpl.calls[1].url, /\/checks\/chk_abc$/u);
});

test('produces a failed check payload when the hosted scan finds violations at threshold', async () => {
  const fetchImpl = fakeFetch([
    { status: 200, body: { id: 'chk_def' } },
    { status: 200, body: { id: 'chk_def' } },
  ]);
  const runHostedScan = async () => ({ total: 2, critical: 0, serious: 2, moderate: 0, minor: 0 });

  const result = await runVercelCheckIntegration({
    rawBody,
    signatureHeader: sign(rawBody),
    webhookSecret: secret,
    vercelToken: 'token-xyz',
    runHostedScan,
    fetchImpl,
  });

  assert.equal(result.payload.conclusion, 'failed');
  const patchBody = JSON.parse(fetchImpl.calls[1].init.body);
  assert.equal(patchBody.conclusion, 'failed');
});

test('rejects the event before scanning when the signature does not verify', async () => {
  const fetchImpl = fakeFetch([]);
  let scanCalled = false;
  const runHostedScan = async () => {
    scanCalled = true;
    return { total: 0, critical: 0, serious: 0, moderate: 0, minor: 0 };
  };

  await assert.rejects(
    () =>
      runVercelCheckIntegration({
        rawBody,
        signatureHeader: 'deadbeef',
        webhookSecret: secret,
        vercelToken: 'token-xyz',
        runHostedScan,
        fetchImpl,
      }),
    WebhookAuthError,
  );

  assert.equal(scanCalled, false);
  assert.equal(fetchImpl.calls.length, 0);
});

test('ignores events that are not deployment.ready without calling the scanner', async () => {
  const otherBody = JSON.stringify({ type: 'deployment.error', deployment: { id: 'dpl_1', url: 'x' } });
  const fetchImpl = fakeFetch([]);
  let scanCalled = false;
  const runHostedScan = async () => {
    scanCalled = true;
    return { total: 0, critical: 0, serious: 0, moderate: 0, minor: 0 };
  };

  const result = await runVercelCheckIntegration({
    rawBody: otherBody,
    signatureHeader: createHmac('sha1', secret).update(otherBody).digest('hex'),
    webhookSecret: secret,
    vercelToken: 'token-xyz',
    runHostedScan,
    fetchImpl,
  });

  assert.equal(result, null);
  assert.equal(scanCalled, false);
});
