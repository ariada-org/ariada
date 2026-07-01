// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const extension = JSON.parse(await readFile(resolve(root, 'vss-extension.json'), 'utf8'));
const task = JSON.parse(await readFile(resolve(root, 'task/task.json'), 'utf8'));
const report = await readFile(resolve(root, 'test-report/result.html'), 'utf8');
const evidence = await readFile(resolve(root, 'scan-evidence/result.html'), 'utf8');

const failures = [];
if (extension.contributions?.[0]?.type !== 'ms.vss-distributed-task.task') failures.push('missing Azure Pipelines task contribution');
if (task.execution?.Node20_1?.target !== 'index.cjs') failures.push('missing Node20_1 task runner');
for (const input of ['targetUrl', 'failOnSeverity', 'outputDir', 'format', 'timeoutMs']) {
  if (!task.inputs.some((candidate) => candidate.name === input)) failures.push(`missing task input: ${input}`);
}
for (const phrase of [
  'What is Azure DevOps?',
  'Why this is a separate Ariada channel',
  'Roles: who pays / what value they buy',
  'Implemented vs not implemented',
  'competitors',
  'domains',
  'technical connectors',
  'evidence',
  'screenshot',
  'blockers',
  'distribution',
  'monetization',
  'sources',
]) {
  const required = phrase.toLowerCase();
  if (!report.toLowerCase().includes(required)) failures.push(`report missing phrase: ${phrase}`);
  if (!evidence.toLowerCase().includes(required)) failures.push(`scan evidence missing phrase: ${phrase}`);
}
if (!/href="[^"]+\.png"/.test(evidence)) failures.push('scan evidence missing direct PNG href');
if (!/<img\s/i.test(evidence)) failures.push('scan evidence missing embedded image');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Azure DevOps extension shape and report phrases OK.');
