#!/usr/bin/env node
import { readFileSync } from 'node:fs';

import { parseReportJson } from './lib/boundary';
import { reportToItems } from './lib/report';

const input = process.argv[2] === '-' || !process.argv[2] ? readFileSync(0, 'utf8') : readFileSync(process.argv[2], 'utf8');
const report = parseReportJson(input);
process.stdout.write(`${JSON.stringify({ report, items: reportToItems(report) }, null, 2)}\n`);
