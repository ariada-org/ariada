import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import commands from '../commands.json' with { type: 'json' };
import { buildDiscordEmbed } from '../dist/embed.js';
import { buildSlashCommandResponse, handleWebhook } from '../dist/webhook.js';

const fixture = JSON.parse(
  await readFile(new URL('../fixtures/scan-result.json', import.meta.url), 'utf8'),
);

test('builds a Discord embed from Ariada CLI JSON', () => {
  const embed = buildDiscordEmbed(fixture);
  assert.equal(embed.title, 'Ariada accessibility gate: FAIL');
  assert.equal(embed.fields[1].value, '2');
  assert.equal(embed.url, fixture.reportUrl);
});

test('validates slash command registration shape', () => {
  assert.equal(commands[0].name, 'ariada');
  assert.equal(commands[0].options[0].required, true);
});

test('handles CI webhook payload without hosting scan logic', () => {
  const response = handleWebhook({ scan: fixture });
  assert.equal(response.embeds[0].fields[0].value, fixture.url);
});

test('rejects non-url slash command input', () => {
  assert.equal(buildSlashCommandResponse('notaurl').ephemeral, true);
});
