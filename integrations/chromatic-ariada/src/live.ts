#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/live.js` and `dist/live.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// THREE OUTCOMES, AND THE THIRD IS THE REASON THIS FILE EXISTS. Absent
// credentials mean nothing was attempted, and that is a skip — an honest zero.
// A present token with a malformed or missing build address is *blocked*, exit
// 2: somebody meant to run this against a real build and the input does not
// describe one. Only a complete, well-formed environment is ready.
//
// Collapsing blocked into skip would be the tempting simplification and the
// wrong one: a misconfigured run would then report success, and a pipeline would
// go green on a check that never happened.
//
// THE ADDRESS IS CONSTRAINED HARD, AND EVERY CLAUSE HAS A JOB: HTTPS, a hostname
// under the service's own domain, no credentials, no port. What this command
// publishes afterwards is a claim about a build on that service, and an address
// pointing anywhere else would make that claim about something else entirely.
//
// The exit code of the real visual tool has to be supplied as a number. This
// command does not run that tool; it carries its verdict, and a verdict it was
// not given is one it must not invent.
//
// The query and fragment are stripped and a trailing slash added, because the
// story index is resolved against this address.

import { pathToFileURL } from 'node:url';

import { bridgeExitCode, runChromaticAriada } from './run.js';

type LiveEnvironment = Record<string, string | undefined>;

export type LivePreflight = {
  status: 'SKIP';
  reason: string;
} | {
  status: 'BLOCKED';
  reason: string;
} | {
  status: 'READY';
  storybookUrl: string;
  chromaticExitCode: number;
  outputDir: string;
  ariadaBinary?: string;
};

export function inspectLiveEnvironment(environment: LiveEnvironment): LivePreflight {
  if (!environment['CHROMATIC_PROJECT_TOKEN']?.trim())
    return { status: 'SKIP', reason: 'CHROMATIC_PROJECT_TOKEN is absent; no live Chromatic claim was attempted.' };
  const rawUrl = environment['CHROMATIC_STORYBOOK_URL']?.trim();
  if (!rawUrl)
    return { status: 'BLOCKED', reason: 'CHROMATIC_STORYBOOK_URL must identify the real published Storybook build.' };
  let url: URL;
  try {
    url = new URL(rawUrl);
  }
  catch {
    return { status: 'BLOCKED', reason: 'CHROMATIC_STORYBOOK_URL is malformed.' };
  }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.chromatic.com') || url.username || url.password || url.port)
    return { status: 'BLOCKED', reason: 'CHROMATIC_STORYBOOK_URL must be a build-specific HTTPS *.chromatic.com URL.' };
  const rawCode = environment['CHROMATIC_EXIT_CODE']?.trim();
  const code = rawCode && /^\d+$/.test(rawCode) ? Number(rawCode) : Number.NaN;
  if (!Number.isSafeInteger(code))
    return { status: 'BLOCKED', reason: 'CHROMATIC_EXIT_CODE must be the non-negative exit code from the real Chromatic CLI run.' };
  if (environment['CHROMATIC_ARIADA_OUTPUT_DIR'] !== undefined && !environment['CHROMATIC_ARIADA_OUTPUT_DIR'].trim())
    return { status: 'BLOCKED', reason: 'CHROMATIC_ARIADA_OUTPUT_DIR must not be empty when provided.' };
  url.pathname = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  url.search = '';
  url.hash = '';
  const outputDir = environment['CHROMATIC_ARIADA_OUTPUT_DIR']?.trim() ?? '.chromatic-ariada-live';
  const binary = environment['ARIADA_BINARY']?.trim();
  return { status: 'READY', storybookUrl: url.href, chromaticExitCode: code, outputDir, ...(binary ? { ariadaBinary: binary } : {}) };
}

export async function runLive(environment: LiveEnvironment = process.env, write: (message: string) => void = console.log): Promise<0 | 1 | 2> {
  const preflight = inspectLiveEnvironment(environment);
  if (preflight.status === 'SKIP') {
    write(`SKIP: ${preflight.reason}`);
    return 0;
  }
  if (preflight.status === 'BLOCKED') {
    write(`BLOCKED: ${preflight.reason}`);
    return 2;
  }
  try {
    const report = await runChromaticAriada({ manifest: new URL('index.json', preflight.storybookUrl).href, previewBaseUrl: preflight.storybookUrl, outputDir: preflight.outputDir, chromaticExitCode: preflight.chromaticExitCode, chromaticBuildUrl: preflight.storybookUrl, chromaticProjectTokenPresent: true, ...(preflight.ariadaBinary ? { ariadaBinary: preflight.ariadaBinary } : {}) });
    const exitCode = bridgeExitCode(report);
    write(report.gates.combined.conclusion === 'passed' ? `PASS: real Chromatic build and ${report.source.storyCount} Ariada story reports passed.` : `FAIL: Chromatic=${report.gates.chromatic.conclusion}, Ariada=${report.gates.ariada.conclusion}.`);
    return exitCode;
  }
  catch (error) {
    write(`BLOCKED: the supplied Chromatic build did not produce trustworthy story evidence: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  runLive().then((exitCode) => { process.exitCode = exitCode; });
