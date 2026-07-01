'use strict';

const { readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const evidence = readFileSync(join(root, 'scan-evidence', 'result.html'), 'utf8');
const required = [
  'What is Framer?',
  'Why this is a separate Ariada channel',
  'Roles: who pays / what value they buy',
  'Implemented vs not implemented'
];

const missing = required.filter((heading) => !readme.includes(heading) || !evidence.includes(heading));
if (missing.length > 0) {
  throw new Error(`README or scan evidence is missing required phrase(s): ${missing.join(', ')}`);
}

const evidenceLower = evidence.toLowerCase();
const reportSections = [
  'competitors',
  'domains',
  'technical connectors',
  'evidence',
  'screenshot',
  'blockers',
  'distribution',
  'monetization',
  'sources'
];

const missingSections = reportSections.filter((section) => !evidenceLower.includes(section));
if (missingSections.length > 0) {
  throw new Error(`scan evidence is missing report section(s): ${missingSections.join(', ')}`);
}

if (!evidence.includes('<img src="./result-screenshot.png"')) {
  throw new Error('scan evidence must embed result-screenshot.png with an img tag');
}
