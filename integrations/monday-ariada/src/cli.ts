// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/cli.js` and `dist/cli.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies are
// the compiled ones. Checked with
// the rebuild check.
//
// EVERY BOARD SETTING COMES FROM THE ENVIRONMENT, and nothing here is a command
// line value. That is deliberate for the token, which must not be visible in a
// process list, and it keeps the rest consistent with it — one place to configure
// a run rather than two that can disagree.
//
// The report is read from a named file or, given none, from standard input, so
// this composes with a scan that writes to a pipe as readily as with one that
// wrote a file. It prints two counts and nothing else: what was filed and what
// was skipped, in a shape another program can read.

import { readFile } from 'node:fs/promises';

import {
  parseAriadaReport,
  createMondayGraphqlClient,
  syncReport,
  type MondaySyncConfig,
} from './index.js';

const report = parseAriadaReport(
  JSON.parse(await readFile(process.argv[2] ?? '/dev/stdin', 'utf8')),
);

const config: MondaySyncConfig = {
  boardId: process.env.MONDAY_BOARD_ID ?? '',
  fingerprintColumnId: process.env.MONDAY_FINGERPRINT_COLUMN_ID ?? 'fingerprint',
  groupId: process.env.MONDAY_GROUP_ID,
  severityColumnId: process.env.MONDAY_SEVERITY_COLUMN_ID,
  ruleIdColumnId: process.env.MONDAY_RULE_ID_COLUMN_ID,
  wcagColumnId: process.env.MONDAY_WCAG_COLUMN_ID,
  selectorColumnId: process.env.MONDAY_SELECTOR_COLUMN_ID,
  statusColumnId: process.env.MONDAY_STATUS_COLUMN_ID,
  reportColumnId: process.env.MONDAY_REPORT_COLUMN_ID,
};

const result = await syncReport(report, createMondayGraphqlClient(), config);
console.log(
  JSON.stringify({ created: result.created.length, skipped: result.skipped.length }, null, 2),
);
