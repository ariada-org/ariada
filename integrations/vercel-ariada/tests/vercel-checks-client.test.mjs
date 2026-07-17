// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import assert from 'node:assert/strict';
import test from 'node:test';

import { createVercelCheck, updateVercelCheck } from '../dist/src/vercel-checks-client.js';

const checkPayload = {
  deploymentId: 'dpl_123',
  name: 'Ariada accessibility check',
  blocking: true,
  status: 'completed',
  conclusion: 'passed',
  output: {
    title: 'Ariada accessibility check passed',
    summary: '0 findings',
    text: 'Threshold: serious. Deployment: preview.example.vercel.app.',
  },
};

function fakeFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) {
      throw new Error(`fakeFetch: no more canned responses (called ${String(url)})`);
    }
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

test('createVercelCheck POSTs to the deployment checks endpoint with a bearer token', async () => {
  const fetchImpl = fakeFetch([{ status: 200, body: { id: 'chk_abc' } }]);

  const result = await createVercelCheck('dpl_123', 'token-xyz', fetchImpl);

  assert.equal(result.id, 'chk_abc');
  assert.equal(fetchImpl.calls.length, 1);
  const [call] = fetchImpl.calls;
  assert.equal(call.url, 'https://api.vercel.com/v1/deployments/dpl_123/checks');
  assert.equal(call.init.method, 'POST');
  assert.equal(call.init.headers.Authorization, 'Bearer token-xyz');
  assert.equal(call.init.headers['Content-Type'], 'application/json');
  const body = JSON.parse(call.init.body);
  assert.equal(body.name, 'Ariada accessibility check');
  assert.equal(body.blocking, true);
});

test('createVercelCheck throws a descriptive error on a non-2xx response', async () => {
  const fetchImpl = fakeFetch([{ status: 401, body: { error: { message: 'invalid token' } } }]);

  await assert.rejects(
    () => createVercelCheck('dpl_123', 'bad-token', fetchImpl),
    /Vercel Checks API create failed \(401\)/u,
  );
});

test('updateVercelCheck PATCHes the specific check with the final payload', async () => {
  const fetchImpl = fakeFetch([{ status: 200, body: { id: 'chk_abc' } }]);

  await updateVercelCheck('dpl_123', 'chk_abc', checkPayload, 'token-xyz', fetchImpl);

  assert.equal(fetchImpl.calls.length, 1);
  const [call] = fetchImpl.calls;
  assert.equal(call.url, 'https://api.vercel.com/v1/deployments/dpl_123/checks/chk_abc');
  assert.equal(call.init.method, 'PATCH');
  assert.equal(call.init.headers.Authorization, 'Bearer token-xyz');
  const body = JSON.parse(call.init.body);
  assert.equal(body.conclusion, 'passed');
  assert.equal(body.status, 'completed');
});

test('updateVercelCheck throws a descriptive error on a non-2xx response', async () => {
  const fetchImpl = fakeFetch([{ status: 500, body: { error: { message: 'boom' } } }]);

  await assert.rejects(
    () => updateVercelCheck('dpl_123', 'chk_abc', checkPayload, 'token-xyz', fetchImpl),
    /Vercel Checks API update failed \(500\)/u,
  );
});
