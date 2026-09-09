// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/plugin.js` and `dist/plugin.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// THE OUTPUT DIRECTORY IS DERIVED FROM WHAT WAS SCANNED, NOT FROM A COUNTER.
// Its name carries the component, the threshold, and a short hash of the fixture
// address, threshold and test session together. Tests run in parallel and the
// same component is often scanned at two thresholds in one run — a shared
// directory would have them overwriting each other's artifacts, and the evidence
// for a failure would belong to a different test.
//
// The hash makes the name stable rather than unique: the same request in the
// same session lands in the same place, so a rerun replaces its own artifacts
// instead of accumulating them.
//
// The payload crosses a process boundary as plain data and is validated before
// anything is done with it. The runner's own options are defaults only; what the
// test asked for wins, because the test is the thing being read when the result
// is questioned.

import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

import { LIT_ARIADA_COMMAND } from './command.js';
import { scanLitFixture } from './scanner.js';
import type { AriadaSeverity, LitAriadaCommandPayload, LitBrowser, LitScanResult } from './types.js';

export { LIT_ARIADA_COMMAND } from './command.js';

export interface LitAriadaPluginOptions {
  readonly outputDirectory?: string;
  readonly browser?: LitBrowser;
  readonly severityThreshold?: AriadaSeverity;
  readonly timeoutMs?: number;
}

export interface WebTestRunnerCommandContext {
  readonly command: string;
  readonly payload?: unknown;
  readonly session?: {
    readonly id?: string;
  };
}

export interface LitAriadaWebTestRunnerPlugin {
  readonly name: 'lit-ariada';
  executeCommand(context: WebTestRunnerCommandContext): Promise<LitScanResult | undefined>;
}

function commandPayload(value: unknown): LitAriadaCommandPayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${LIT_ARIADA_COMMAND} requires a JSON object payload`);
  }
  const source = value as Record<string, unknown>;
  if (typeof source['fixtureUrl'] !== 'string' || typeof source['componentSelector'] !== 'string') {
    throw new TypeError(`${LIT_ARIADA_COMMAND} requires fixtureUrl and componentSelector strings`);
  }
  return {
    fixtureUrl: source['fixtureUrl'],
    componentSelector: source['componentSelector'],
    ...(typeof source['browser'] === 'string' ? { browser: source['browser'] as LitBrowser } : {}),
    ...(typeof source['severityThreshold'] === 'string'
      ? { severityThreshold: source['severityThreshold'] as AriadaSeverity }
      : {}),
    ...(typeof source['timeoutMs'] === 'number' ? { timeoutMs: source['timeoutMs'] } : {}),
  };
}

export function createLitAriadaPlugin(defaults: LitAriadaPluginOptions = {}): LitAriadaWebTestRunnerPlugin {
  const rootOutput = resolve(defaults.outputDirectory ?? '.lit-ariada-output');
  return {
    name: 'lit-ariada',
    async executeCommand({ command, payload, session }) {
      if (command !== LIT_ARIADA_COMMAND) return undefined;
      const request = commandPayload(payload);
      const severityThreshold = request.severityThreshold ?? defaults.severityThreshold ?? 'serious';
      const key = [
        request.fixtureUrl,
        request.componentSelector,
        severityThreshold,
        session?.id ?? 'session',
      ].join('|');
      const outputDirectory = resolve(rootOutput, `${request.componentSelector}-${severityThreshold}-${createHash('sha256').update(key).digest('hex').slice(0, 12)}`);
      return await scanLitFixture({
        ...request,
        outputDirectory,
        severityThreshold,
        ...((request.browser ?? defaults.browser) === undefined
          ? {}
          : { browser: request.browser ?? defaults.browser }),
        ...((request.timeoutMs ?? defaults.timeoutMs) === undefined
          ? {}
          : { timeoutMs: request.timeoutMs ?? defaults.timeoutMs }),
      });
    },
  };
}
