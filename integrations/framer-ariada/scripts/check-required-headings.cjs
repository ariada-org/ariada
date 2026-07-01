'use strict';

const { readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const readme = readFileSync(join(resolve(__dirname, '..'), 'README.md'), 'utf8');
const required = [
  'What is Framer?',
  'Why this is a separate Ariada channel',
  'Roles: who pays / what value they buy',
  'Implemented vs not implemented'
];

const missing = required.filter((heading) => !readme.includes(heading));
if (missing.length > 0) {
  throw new Error(`README is missing required phrase(s): ${missing.join(', ')}`);
}
