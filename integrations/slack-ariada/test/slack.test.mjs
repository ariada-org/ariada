import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildCiGateFailureMessage,
  buildScanRequestResponse,
  createFixtureServer,
  parseScanCommand,
} from '../dist/index.js';

const ciFixture = JSON.parse(
  await readFile(new URL('../fixtures/ci-gate-failure.json', import.meta.url), 'utf8'),
);

test('parses the Slack slash command body', () => {
  assert.deepEqual(parseScanCommand('scan https://example.test'), {
    url: 'https://example.test',
  });
  assert.equal(parseScanCommand('help'), null);
});

test('returns a Slack ephemeral command acknowledgement', () => {
  const response = buildScanRequestResponse('scan https://example.test');
  assert.equal(response.response_type, 'ephemeral');
  assert.match(response.text, /Ariada scan requested/);
  assert.match(response.blocks[0].text.text, /hosted scan API/);
});

test('renders a CI gate failure notification fixture', () => {
  const response = buildCiGateFailureMessage(ciFixture);
  assert.equal(response.text, 'Ariada CI gate failed for ariada-org/example-store');
  assert.match(response.blocks[0].text.text, /Ariada CI gate failed/);
  assert.equal(response.blocks.at(-1).elements[0].url, ciFixture.pipelineUrl);
});

test('runs the local fixture server command and webhook flow', async () => {
  const fixture = createFixtureServer(ciFixture);
  const baseUrl = await fixture.start();
  try {
    const command = await fetch(`${baseUrl}/slack/command`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ command: '/ariada', text: 'scan https://example.test' }),
    });
    const commandJson = await command.json();
    assert.equal(commandJson.response_type, 'ephemeral');

    const webhook = await fetch(`${baseUrl}/ci/gate-failure`, { method: 'POST' });
    const webhookJson = await webhook.json();
    assert.match(webhookJson.text, /CI gate failed/);
  } finally {
    await fixture.stop();
  }
});
