#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/remote/bin.js` and `dist/remote/bin.d.ts`. The source
// this was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shape comes back from the declaration file and the body
// is the compiled one. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// Both settings are refused rather than defaulted when they are wrong. A service
// that starts with no application identifier would verify nothing, and a port
// outside the range would fail later with a message about something else.
// Exit 2 means "this configuration is wrong", which is a different problem from
// a scan that failed.

import { startRemoteServer } from './server.js';

const appId = process.env['FORGE_APP_ID'];
if (!appId) {
  process.stderr.write('FORGE_APP_ID is required; use the UUID from the registered Forge app.\n');
  process.exit(2);
}
const port = Number.parseInt(process.env['PORT'] ?? '3000', 10);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  process.stderr.write('PORT must be an integer from 1 through 65535.\n');
  process.exit(2);
}
const server = startRemoteServer({ appId, port });
process.stdout.write(`confluence-ariada remote listening on port ${port}\n`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
