// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2

// The mapping, runnable without the platform. Given a report it prints what a
// trigger would have emitted, which is how the shape is checked against a real
// scan without waiting for a webhook to fire.

import { readFileSync } from 'node:fs';

import { mapScanCompleted, mapViolations, parseReport } from './mapper';

const event = process.argv[2] ?? 'violation';
const file = process.argv[3];
// A path if given, standard input otherwise: descriptor zero reads a pipe.
const raw = file ? readFileSync(file, 'utf8') : readFileSync(0, 'utf8');
const report = parseReport(JSON.parse(raw));

process.stdout.write(
  `${JSON.stringify(
    event === 'scan-completed' ? mapScanCompleted(report) : mapViolations(report),
    null,
    2,
  )}\n`,
);
